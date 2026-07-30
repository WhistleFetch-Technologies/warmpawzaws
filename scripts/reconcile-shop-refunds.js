#!/usr/bin/env node
/**
 * Reconcile stuck shop refunds: poll Razorpay GET /refunds/:id and sync DB.
 * Mirrors backend reconcileShopRefundById / reconcileStuckShopRefunds.
 *
 * Usage:
 *   ENVIRONMENT=prod node scripts/reconcile-shop-refunds.js
 *   ENVIRONMENT=prod node scripts/reconcile-shop-refunds.js --refund-id <uuid>
 *   ENVIRONMENT=prod node scripts/reconcile-shop-refunds.js --order-number ORD-1784810695659-47
 *   ENVIRONMENT=dev node scripts/reconcile-shop-refunds.js --limit 5 --min-age-minutes 0
 *
 * Uses RDS Data API (no VPC required). Razorpay keys from Secrets Manager.
 */

const { execSync } = require('child_process');
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function mapRazorpayRefundEventStatus(rzStatus) {
  const s = String(rzStatus || '').toLowerCase();
  if (s === 'processed') return 'completed';
  if (s === 'failed') return 'failed';
  return 'processing';
}

function escSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

/** RDS Data API rows may be objects or positional arrays depending on metadata. */
function cell(row, name, index) {
  if (!row) return undefined;
  if (typeof row === 'object' && !Array.isArray(row)) return row[name];
  if (Array.isArray(row)) return row[index];
  return undefined;
}

function parseArgs(argv) {
  const out = { refundId: null, orderNumber: null, limit: 10, minAgeMinutes: 60 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--refund-id' && argv[i + 1]) out.refundId = argv[++i];
    else if (a === '--order-number' && argv[i + 1]) out.orderNumber = argv[++i];
    else if (a === '--limit' && argv[i + 1]) out.limit = parseInt(argv[++i], 10) || 10;
    else if (a === '--min-age-minutes' && argv[i + 1]) out.minAgeMinutes = parseInt(argv[++i], 10) || 0;
  }
  return out;
}

function loadRazorpayConfig() {
  const secretId = ENVIRONMENT === 'prod' ? 'warmpawz/prod/razorpay' : 'warmpawz/dev/razorpay';
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id ${secretId} --region ${REGION} --output json`,
    { encoding: 'utf8' },
  );
  const cfg = JSON.parse(JSON.parse(raw).SecretString);
  if (!cfg.keyId || !cfg.keySecret) throw new Error(`Missing Razorpay keys in ${secretId}`);
  const auth = `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`;
  return { secretId, auth };
}

async function fetchRazorpayRefund(auth, refundId) {
  const url = `https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`;
  const res = await fetch(url, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Razorpay ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function applyShopRefundDbState(row, rzStatus) {
  const dbStatus = mapRazorpayRefundEventStatus(rzStatus);
  const refundAmountInr = parseFloat(String(row.refund_amount)) || 0;
  const paymentAmountInr = parseFloat(String(row.payment_amount)) || 0;
  const isFullRefund = refundAmountInr >= paymentAmountInr - 0.009;
  const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

  await executeSQL(
    `UPDATE refunds
     SET refund_status = '${escSql(dbStatus)}',
         razorpay_refund_id = COALESCE(razorpay_refund_id, '${escSql(row.razorpay_refund_id)}'),
         processed_at = COALESCE(processed_at, NOW()),
         completed_at = CASE WHEN '${escSql(dbStatus)}' = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
         retry_count = CASE WHEN '${escSql(dbStatus)}' = 'failed' THEN retry_count + 1 ELSE retry_count END
     WHERE id = '${escSql(row.id)}'::uuid`,
    false,
  );

  await executeSQL(
    `UPDATE payments SET payment_status = '${escSql(newPaymentStatus)}', updated_at = NOW()
     WHERE id = '${escSql(row.payment_id)}'::uuid`,
    false,
  );

  if (isFullRefund) {
    await executeSQL(
      `UPDATE orders
       SET payment_status = 'refunded', updated_at = NOW()
       WHERE id = '${escSql(row.order_id)}'::uuid
         AND LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed')`,
      false,
    );
  }

  return dbStatus;
}

async function reconcileOne(auth, refundId) {
  const rows = await query(
    `SELECT r.id::text, r.order_id::text, r.payment_id::text, r.refund_amount::text,
            r.razorpay_refund_id, r.refund_status, o.order_number,
            p.amount::text AS payment_amount
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     JOIN orders o ON o.id = r.order_id
     WHERE r.id = '${escSql(refundId)}'::uuid AND r.order_id IS NOT NULL
     LIMIT 1`,
  );
  const row = rows[0];
  if (!row) {
    console.log(`  skip: refund not found ${refundId}`);
    return { ok: false, error: 'not found' };
  }
  const normalized = {
    id: cell(row, 'id', 0),
    order_id: cell(row, 'order_id', 1),
    payment_id: cell(row, 'payment_id', 2),
    refund_amount: cell(row, 'refund_amount', 3),
    razorpay_refund_id: cell(row, 'razorpay_refund_id', 4),
    refund_status: cell(row, 'refund_status', 5),
    order_number: cell(row, 'order_number', 6),
    payment_amount: cell(row, 'payment_amount', 7),
  };
  if (!normalized.id) {
    console.log(`  skip: could not parse refund row ${refundId}`);
    return { ok: false, error: 'parse failed' };
  }
  if (!normalized.razorpay_refund_id) {
    console.log(`  skip: ${normalized.order_number} — no razorpay_refund_id (use initiate/retry)`);
    return { ok: false, error: 'no razorpay_refund_id' };
  }
  if (normalized.refund_status === 'completed') {
    console.log(`  ok: ${normalized.order_number} already completed`);
    return { ok: true, status: 'completed' };
  }

  const rz = await fetchRazorpayRefund(auth, normalized.razorpay_refund_id);
  console.log(`  Razorpay ${normalized.razorpay_refund_id}: status=${rz.status}`);

  const dbStatus = await applyShopRefundDbState(normalized, rz.status);
  console.log(`  DB updated: ${normalized.order_number} → ${dbStatus}`);
  return { ok: dbStatus !== 'failed', status: dbStatus };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[reconcile-shop-refunds] ENVIRONMENT=${ENVIRONMENT}`);
  const { auth, secretId } = loadRazorpayConfig();
  console.log(`Razorpay secret: ${secretId}`);

  if (args.orderNumber) {
    const lookup = await query(
      `SELECT r.id::text FROM refunds r
       JOIN orders o ON o.id = r.order_id
       WHERE o.order_number = '${escSql(args.orderNumber)}'
       ORDER BY r.requested_at DESC NULLS LAST LIMIT 1`,
    );
    if (!lookup[0]) throw new Error(`No refund row for order ${args.orderNumber}`);
    args.refundId = cell(lookup[0], 'id', 0);
    if (!args.refundId) throw new Error(`Could not parse refund id for order ${args.orderNumber}`);
  }

  if (args.refundId) {
    console.log(`Reconciling refund ${args.refundId}...`);
    const result = await reconcileOne(auth, args.refundId);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  const stuck = await query(
    `SELECT r.id::text, o.order_number
     FROM refunds r
     JOIN orders o ON o.id = r.order_id
     WHERE r.order_id IS NOT NULL
       AND r.refund_status = 'processing'
       AND r.razorpay_refund_id IS NOT NULL
       AND r.completed_at IS NULL
       AND r.processed_at < NOW() - (${args.minAgeMinutes} * INTERVAL '1 minute')
     ORDER BY r.processed_at ASC NULLS LAST
     LIMIT ${args.limit}`,
  );

  if (stuck.length === 0) {
    console.log('No stuck processing refunds to reconcile.');
    return;
  }

  console.log(`Found ${stuck.length} stuck refund(s):`);
  let reconciled = 0;
  for (const row of stuck) {
    const id = cell(row, 'id', 0);
    const orderNumber = cell(row, 'order_number', 1);
    console.log(`\n${orderNumber} (${id})`);
    const result = await reconcileOne(auth, id);
    if (result.ok && result.status === 'completed') reconciled += 1;
  }
  console.log(`\nDone. Completed: ${reconciled}/${stuck.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

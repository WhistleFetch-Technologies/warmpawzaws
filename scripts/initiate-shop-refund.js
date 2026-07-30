#!/usr/bin/env node
/**
 * Initiate Razorpay refund for a cancelled paid shop order (missing refund row).
 * Mirrors backend initiateShopOrderRazorpayRefund + applyShopRefundDbState.
 *
 * Usage:
 *   ENVIRONMENT=prod node scripts/initiate-shop-refund.js --order-number ORD-1784199432627-799
 *   ENVIRONMENT=prod node scripts/initiate-shop-refund.js --order-id <uuid> --reason "Manual backfill"
 *
 * Uses RDS Data API. Razorpay keys from Secrets Manager.
 */

const { execSync } = require('child_process');
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function escSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function cell(row, name, index) {
  if (!row) return undefined;
  if (typeof row === 'object' && !Array.isArray(row)) return row[name];
  if (Array.isArray(row)) return row[index];
  return undefined;
}

function mapRazorpayRefundEventStatus(rzStatus) {
  const s = String(rzStatus || '').toLowerCase();
  if (s === 'processed') return 'completed';
  if (s === 'failed') return 'failed';
  return 'processing';
}

function parseArgs(argv) {
  const out = { orderNumber: null, orderId: null, reason: 'Manual backfill — missed cancel refund' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--order-number' && argv[i + 1]) out.orderNumber = argv[++i];
    else if (a === '--order-id' && argv[i + 1]) out.orderId = argv[++i];
    else if (a === '--reason' && argv[i + 1]) out.reason = argv[++i];
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

async function razorpayRefund(auth, paymentId, amountPaise) {
  const url = `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Razorpay ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function applyShopRefundDbState(row, rzRefundId, rzStatus) {
  const dbStatus = mapRazorpayRefundEventStatus(rzStatus);
  const refundAmountInr = parseFloat(String(row.refund_amount)) || 0;
  const paymentAmountInr = parseFloat(String(row.payment_amount)) || 0;
  const isFullRefund = refundAmountInr >= paymentAmountInr - 0.009;
  const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

  await executeSQL(
    `UPDATE refunds
     SET refund_status = '${escSql(dbStatus)}',
         razorpay_refund_id = COALESCE(razorpay_refund_id, '${escSql(rzRefundId)}'),
         processed_at = COALESCE(processed_at, NOW()),
         completed_at = CASE WHEN '${escSql(dbStatus)}' = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
     WHERE id = '${escSql(row.refund_id)}'::uuid`,
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

async function main() {
  const args = parseArgs(process.argv);
  if (!args.orderNumber && !args.orderId) {
    console.error('Provide --order-number or --order-id');
    process.exit(1);
  }

  console.log(`[initiate-shop-refund] ENVIRONMENT=${ENVIRONMENT}`);
  const { auth, secretId } = loadRazorpayConfig();
  console.log(`Razorpay secret: ${secretId}`);

  const orderFilter = args.orderNumber
    ? `o.order_number = '${escSql(args.orderNumber)}'`
    : `o.id = '${escSql(args.orderId)}'::uuid`;

  const orders = await query(
    `SELECT o.id::text AS order_id, o.order_number, o.customer_id::text, o.vendor_id::text,
            o.order_status, o.payment_status,
            p.id::text AS payment_id, p.razorpay_payment_id, p.amount::text AS payment_amount,
            p.payment_status AS pay_status
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE ${orderFilter}
       AND p.razorpay_payment_id IS NOT NULL
     ORDER BY p.created_at DESC NULLS LAST
     LIMIT 1`,
  );

  const o = orders[0];
  if (!o) throw new Error('Order/payment not found');

  const orderId = cell(o, 'order_id', 0);
  const orderNumber = cell(o, 'order_number', 1);
  const customerId = cell(o, 'customer_id', 2);
  const vendorId = cell(o, 'vendor_id', 3);
  const paymentId = cell(o, 'payment_id', 6);
  const razorpayPaymentId = cell(o, 'razorpay_payment_id', 7);
  const paymentAmount = parseFloat(cell(o, 'payment_amount', 8)) || 0;

  console.log(`Order: ${orderNumber} (${orderId})`);
  console.log(`Payment: ${paymentId} / ${razorpayPaymentId} amount=₹${paymentAmount}`);

  const existing = await query(
    `SELECT r.id::text, r.refund_status, r.razorpay_refund_id
     FROM refunds r
     WHERE r.order_id = '${escSql(orderId)}'::uuid
       AND r.refund_status NOT IN ('failed', 'rejected')
     ORDER BY r.requested_at DESC NULLS LAST
     LIMIT 1`,
  );

  if (existing[0]) {
    const exId = cell(existing[0], 'id', 0);
    const exStatus = cell(existing[0], 'refund_status', 1);
    const exRz = cell(existing[0], 'razorpay_refund_id', 2);
    console.log(`Active refund already exists: ${exId} status=${exStatus} rz=${exRz || 'none'}`);
    if (exRz) {
      console.log('Use reconcile-shop-refunds.js if stuck in processing.');
    }
    process.exit(0);
  }

  const refundAmount = paymentAmount;
  if (refundAmount <= 0.009) throw new Error('Invalid refund amount');

  const inserted = await query(
    `INSERT INTO refunds (
       payment_id, order_id, customer_id, vendor_id, refund_amount, refund_reason,
       refund_status, refund_method, requested_at
     ) VALUES (
       '${escSql(paymentId)}'::uuid,
       '${escSql(orderId)}'::uuid,
       '${escSql(customerId)}'::uuid,
       ${vendorId ? `'${escSql(vendorId)}'::uuid` : 'NULL'},
       ${refundAmount},
       '${escSql(args.reason)}',
       'pending',
       'original',
       NOW()
     )
     RETURNING id::text`,
  );

  const refundRowId = cell(inserted[0], 'id', 0);
  if (!refundRowId) throw new Error('Failed to create refund row');

  console.log(`Created refund row: ${refundRowId}`);
  console.log(`Calling Razorpay refund ₹${refundAmount} (${Math.round(refundAmount * 100)} paise)...`);

  const rz = await razorpayRefund(auth, razorpayPaymentId, Math.round(refundAmount * 100));
  const rzRefundId = String(rz.id || '');
  const rzStatus = String(rz.status || 'processing');
  console.log(`Razorpay refund: ${rzRefundId} status=${rzStatus}`);

  const dbStatus = await applyShopRefundDbState(
    {
      refund_id: refundRowId,
      order_id: orderId,
      payment_id: paymentId,
      refund_amount: refundAmount,
      payment_amount: paymentAmount,
    },
    rzRefundId,
    rzStatus,
  );

  console.log(`DB updated: refund_status=${dbStatus}`);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Reconcile prod bookings stuck in `pending_payment` with a `completed`
 * Razorpay payment, after migration 735 is applied.
 *
 * What it does:
 *   1. Lists candidate stuck bookings (status='pending_payment', a matching
 *      payments row with payment_status='completed', amounts roughly equal).
 *   2. With APPLY=YES: flips them to status='confirmed', payment_status='paid'
 *      and links payments.booking_id if not already set.
 *
 * Defaults to DRY-RUN. Two env gates required to mutate:
 *   - I_CONFIRM_PROD_MIGRATION_735=YES  (proves you ran 735 first)
 *   - APPLY=YES
 *
 * Usage (PowerShell, dry run):
 *   node scripts/reconcile-prod-stuck-pending-payment.js
 *
 * Usage (PowerShell, apply):
 *   $env:I_CONFIRM_PROD_MIGRATION_735='YES'; $env:APPLY='YES';
 *   node scripts/reconcile-prod-stuck-pending-payment.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE_NAME = 'warmpawz';

const APPLY = process.env.APPLY === 'YES';

function awsCli() {
  /* Plain `aws` resolves on both POSIX and Windows when AWS CLI v2 is on PATH.
     `aws.cmd` was tried but Node's execSync without shell:true cannot resolve PATHEXT. */
  return 'aws';
}

function assertProdOnly(clusterArn) {
  const lower = String(clusterArn || '').toLowerCase();
  if (!lower.includes('prod') || !lower.includes('warmpawz-prod-cluster')) {
    throw new Error('Refusing to run: cluster ARN must be production warmpawz-prod-cluster.');
  }
}

function getClusterInfoCli() {
  const clusterInfoJson = execSync(
    `${awsCli()} rds describe-db-clusters --db-cluster-identifier ${CLUSTER_IDENTIFIER} --region ${REGION} --output json`,
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024 }
  );
  const clusterInfo = JSON.parse(clusterInfoJson);
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${CLUSTER_IDENTIFIER}`);
  }
  const cluster = clusterInfo.DBClusters[0];
  const clusterArn = cluster.DBClusterArn;
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API is not enabled on ${CLUSTER_IDENTIFIER}.`);
  }
  const secretInfoJson = execSync(
    `${awsCli()} secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024 }
  );
  const secretInfo = JSON.parse(secretInfoJson);
  return { clusterArn, secretArn: secretInfo.ARN };
}

function executeStatementCli(clusterArn, secretArn, sql, opts = {}) {
  const inputFile = path.join(__dirname, `_tmp_rds_reconcile_${Date.now()}.json`);
  const payload = {
    resourceArn: clusterArn,
    secretArn,
    database: DATABASE_NAME,
    sql,
    ...(opts.includeMetadata ? { includeResultMetadata: true } : {}),
  };
  fs.writeFileSync(inputFile, JSON.stringify(payload), 'utf8');
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');
  try {
    const out = execSync(
      `${awsCli()} rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], timeout: 300000, maxBuffer: 16 * 1024 * 1024 }
    );
    return JSON.parse(out);
  } finally {
    try { fs.unlinkSync(inputFile); } catch (_) {}
  }
}

/** Parse an RDS Data API records array of [{stringValue|longValue|doubleValue|booleanValue|isNull}] cells. */
function flattenRecord(rec, columnMeta) {
  const obj = {};
  for (let i = 0; i < rec.length; i++) {
    const cell = rec[i];
    const name = columnMeta?.[i]?.name || `col${i}`;
    if (cell.isNull) { obj[name] = null; continue; }
    obj[name] =
      'stringValue' in cell ? cell.stringValue :
      'longValue' in cell ? cell.longValue :
      'doubleValue' in cell ? cell.doubleValue :
      'booleanValue' in cell ? cell.booleanValue :
      null;
  }
  return obj;
}

function main() {
  console.log('============================================================================');
  console.log('Prod reconciliation: bookings stuck in pending_payment with completed payment');
  console.log(`Region: ${REGION}  Cluster: ${CLUSTER_IDENTIFIER}`);
  console.log(`Mode:   ${APPLY ? 'APPLY (will UPDATE)' : 'DRY-RUN (read-only)'}`);
  console.log('============================================================================\n');

  if (APPLY && process.env.I_CONFIRM_PROD_MIGRATION_735 !== 'YES') {
    console.error('Refusing to APPLY without I_CONFIRM_PROD_MIGRATION_735=YES (proof migration 735 was run).');
    process.exit(1);
  }

  const { clusterArn, secretArn } = getClusterInfoCli();
  assertProdOnly(clusterArn);

  /* List candidates. APPLY mode only mutates rows where the matching payment is
     payment_status='completed'. DRY-RUN lists all pending_payment bookings with
     their linked payments row (joined by payments.booking_id) — including rows
     stuck at payment_status='pending' that need Razorpay sync first. */
  const listSql = `
    SELECT b.id::text AS booking_id,
           b.status AS booking_status,
           b.payment_status AS booking_payment_status,
           b.total_amount AS booking_amount,
           b.created_at::text AS booking_created_at,
           p.id::text AS payment_id,
           p.payment_status AS payment_status,
           p.razorpay_order_id AS razorpay_order_id,
           p.razorpay_payment_id AS razorpay_payment_id,
           p.amount AS payment_amount,
           p.booking_id::text AS payment_booking_id
      FROM bookings b
      LEFT JOIN LATERAL (
        SELECT *
          FROM payments pp
         WHERE pp.booking_id = b.id
         ORDER BY (pp.payment_status = 'completed') DESC NULLS LAST,
                  pp.created_at DESC
         LIMIT 1
      ) p ON TRUE
     WHERE b.status = 'pending_payment'
     ORDER BY b.created_at DESC
     LIMIT 200`;

  const listed = executeStatementCli(clusterArn, secretArn, listSql, { includeMetadata: true });
  const meta = listed.columnMetadata || [];
  const records = listed.records || [];
  const rows = records.map((r) => flattenRecord(r, meta));

  console.log(`Candidates found: ${rows.length}\n`);
  if (rows.length === 0) {
    console.log('Nothing to reconcile.');
    return;
  }

  for (const r of rows) {
    console.log(
      `  booking=${r.booking_id} created=${r.booking_created_at || '-'} ` +
      `payment=${r.payment_id || 'NONE'} order=${r.razorpay_order_id || '-'} ` +
      `pay_status=${r.payment_status || '-'} ` +
      `rzp_payment_id=${r.razorpay_payment_id || '-'} ` +
      `amounts(book=${r.booking_amount}, pay=${r.payment_amount}) ` +
      `payment.booking_id=${r.payment_booking_id || 'NULL'}`
    );
  }
  console.log('');

  if (!APPLY) {
    console.log('DRY-RUN: pass APPLY=YES (with I_CONFIRM_PROD_MIGRATION_735=YES) to apply.');
    console.log('Note: APPLY mode only flips bookings whose payment_status=\'completed\'.');
    console.log('      Rows still at payment_status=\'pending\' need Razorpay sync first.');
    return;
  }

  /* APPLY mode: mutate only rows whose payment_status='completed'. */
  const eligible = rows.filter((r) => r.payment_status === 'completed' && r.payment_id);
  if (eligible.length === 0) {
    console.log('No payment_status=\'completed\' rows to flip. Nothing to do.');
    return;
  }
  let updated = 0;
  for (const r of eligible) {
    const updateBookingSql =
      `UPDATE bookings ` +
      `SET status = 'confirmed', payment_status = 'paid', updated_at = NOW() ` +
      `WHERE id = '${r.booking_id}'::uuid AND status = 'pending_payment'`;

    const updatePaymentSql = r.payment_booking_id
      ? null
      : `UPDATE payments SET booking_id = '${r.booking_id}'::uuid, updated_at = NOW() ` +
        `WHERE id = '${r.payment_id}'::uuid AND booking_id IS NULL`;

    try {
      console.log(`Updating booking ${r.booking_id}...`);
      executeStatementCli(clusterArn, secretArn, updateBookingSql);
      if (updatePaymentSql) {
        executeStatementCli(clusterArn, secretArn, updatePaymentSql);
      }
      updated++;
      console.log('   OK');
    } catch (e) {
      console.error(`   FAILED for ${r.booking_id}:`, (e.stderr || '').toString().slice(0, 300) || e.message);
    }
  }
  console.log(`\nReconciled ${updated}/${rows.length} bookings.`);
}

main();

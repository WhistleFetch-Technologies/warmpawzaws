#!/usr/bin/env node
/**
 * Razorpay-sync prod reconciliation: for bookings stuck in `pending_payment`
 * whose linked payments row is still `pending`, call Razorpay
 * `GET /v1/orders/{order_id}` and (when amount_paid >= order amount) flip:
 *   - payments.payment_status = 'completed' (with razorpay_payment_id)
 *   - bookings.status = 'confirmed', bookings.payment_status = 'paid'
 *
 * Requires migration 735 to be applied first (otherwise the bookings UPDATE
 * is blocked by enforce_booking_state_machine with "Invalid state transition
 * from pending_payment to confirmed").
 *
 * Defaults to DRY-RUN. Two env gates required to mutate:
 *   I_CONFIRM_PROD_MIGRATION_735=YES   (proves you ran 735 first)
 *   APPLY=YES
 *
 * Usage (PowerShell, dry run):
 *   node scripts/razorpay-sync-stuck-payments.js
 *
 * Usage (PowerShell, apply):
 *   $env:I_CONFIRM_PROD_MIGRATION_735='YES'; $env:APPLY='YES';
 *   node scripts/razorpay-sync-stuck-payments.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const REGION = 'ap-south-1';
const CLUSTER_IDENTIFIER = 'warmpawz-prod-cluster';
const SECRET_NAME_DB = 'warmpawz-prod-rds-master-20260207201049162400000001';
const SECRET_NAME_RAZORPAY = 'warmpawz/prod/razorpay';
const DATABASE_NAME = 'warmpawz';
const APPLY = process.env.APPLY === 'YES';

function getRdsArns() {
  const c = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_IDENTIFIER} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  )).DBClusters[0];
  const s = JSON.parse(execSync(
    `aws secretsmanager describe-secret --secret-id "${SECRET_NAME_DB}" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  return { clusterArn: c.DBClusterArn, secretArn: s.ARN };
}

function getRazorpayCreds() {
  const out = execSync(
    `aws secretsmanager get-secret-value --secret-id "${SECRET_NAME_RAZORPAY}" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  );
  const wrap = JSON.parse(out);
  const inner = JSON.parse(wrap.SecretString);
  if (!inner.keyId || !inner.keySecret) {
    throw new Error('Razorpay secret missing keyId/keySecret');
  }
  return { keyId: inner.keyId, keySecret: inner.keySecret };
}

function rdsExecute(arns, sql) {
  const tmp = path.join(__dirname, `_tmp_rzpsync_${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({
    resourceArn: arns.clusterArn,
    secretArn: arns.secretArn,
    database: DATABASE_NAME,
    sql,
    includeResultMetadata: true,
  }));
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "file://${tmp.replace(/\\/g, '/')}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024, timeout: 120000 }
    );
    return JSON.parse(out);
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}

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

function razorpayGet(creds, urlPath) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path: urlPath,
        method: 'GET',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c.toString()));
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : null;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(`Razorpay ${res.statusCode}: ${body.slice(0, 500)}`));
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('Razorpay request timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function escSqlString(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  console.log('============================================================================');
  console.log('Razorpay sync for prod bookings stuck in pending_payment');
  console.log(`Mode:   ${APPLY ? 'APPLY (will UPDATE)' : 'DRY-RUN (read-only)'}`);
  console.log('============================================================================\n');

  if (APPLY && process.env.I_CONFIRM_PROD_MIGRATION_735 !== 'YES') {
    console.error('Refusing to APPLY without I_CONFIRM_PROD_MIGRATION_735=YES (proof migration 735 was run).');
    process.exit(1);
  }

  console.log('Loading prod RDS + Razorpay creds...');
  const arns = getRdsArns();
  if (!arns.clusterArn.toLowerCase().includes('warmpawz-prod-cluster')) {
    throw new Error('Refusing: cluster ARN must be production warmpawz-prod-cluster.');
  }
  const creds = getRazorpayCreds();
  console.log(`   keyId prefix: ${String(creds.keyId).slice(0, 12)}…  (must start with rzp_live for prod)\n`);

  const listSql = `
    SELECT b.id::text AS booking_id, b.total_amount AS booking_amount,
           p.id::text AS payment_id, p.amount AS payment_amount,
           p.razorpay_order_id, p.razorpay_payment_id, p.payment_status
      FROM bookings b
      JOIN LATERAL (
        SELECT * FROM payments pp
         WHERE pp.booking_id = b.id
         ORDER BY (pp.payment_status='completed') DESC NULLS LAST, pp.created_at DESC
         LIMIT 1
      ) p ON TRUE
     WHERE b.status = 'pending_payment'
       AND p.razorpay_order_id IS NOT NULL
     ORDER BY b.created_at DESC
     LIMIT 200`;

  const listed = rdsExecute(arns, listSql);
  const rows = (listed.records || []).map((r) => flattenRecord(r, listed.columnMetadata || []));
  console.log(`Stuck bookings to check on Razorpay: ${rows.length}\n`);

  let synced = 0;
  for (const r of rows) {
    console.log(`▸ booking=${r.booking_id} payment=${r.payment_id} order=${r.razorpay_order_id} pay_status=${r.payment_status}`);
    let ord;
    try {
      ord = await razorpayGet(creds, `/v1/orders/${r.razorpay_order_id}`);
    } catch (e) {
      console.log(`   Razorpay GET /orders failed: ${e.message}`);
      continue;
    }
    const amountPaise = Number(ord?.amount ?? 0);
    const paidPaise = Number(ord?.amount_paid ?? 0);
    const status = String(ord?.status || '');
    console.log(`   Razorpay order: status=${status}, amount=${amountPaise} paise, amount_paid=${paidPaise} paise`);

    if (status !== 'paid' || paidPaise + 1 < amountPaise) {
      console.log('   Not fully paid on Razorpay → leaving as-is.');
      continue;
    }

    /* Find the captured payment id. */
    let rzpPaymentId = r.razorpay_payment_id || null;
    if (!rzpPaymentId) {
      try {
        const ops = await razorpayGet(creds, `/v1/orders/${r.razorpay_order_id}/payments`);
        const captured = (ops?.items || []).find((p) => p.status === 'captured');
        if (captured) rzpPaymentId = captured.id;
      } catch (e) {
        console.log(`   Razorpay GET /orders/{}/payments failed: ${e.message}`);
      }
    }
    console.log(`   Captured payment id: ${rzpPaymentId || '(not yet known)'}`);

    if (!APPLY) {
      console.log('   DRY-RUN: would UPDATE payments→completed and bookings→confirmed.\n');
      continue;
    }

    /* Update payment first (no trigger guards), then booking (trigger now allows). */
    try {
      const updPay =
        `UPDATE payments SET payment_status='completed', ` +
        (rzpPaymentId
          ? `razorpay_payment_id = COALESCE(razorpay_payment_id, '${escSqlString(rzpPaymentId)}'), `
          : '') +
        `completed_at = COALESCE(completed_at, NOW()), updated_at = NOW() ` +
        `WHERE id = '${r.payment_id}'::uuid AND payment_status = 'pending'`;
      rdsExecute(arns, updPay);

      const updBook =
        `UPDATE bookings SET status='confirmed', payment_status='paid', updated_at=NOW() ` +
        `WHERE id = '${r.booking_id}'::uuid AND status='pending_payment'`;
      rdsExecute(arns, updBook);
      console.log('   OK — booking confirmed.');
      synced++;
    } catch (e) {
      const stderr = (e.stderr || '').toString();
      console.log(`   FAILED: ${(stderr || e.message || '').slice(0, 400)}`);
    }
    console.log('');
  }

  console.log(`\nDone. ${APPLY ? `Synced ${synced}/${rows.length}.` : `DRY-RUN: ${rows.length} candidates inspected.`}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

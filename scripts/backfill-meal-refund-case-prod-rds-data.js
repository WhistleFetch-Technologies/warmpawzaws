#!/usr/bin/env node
/**
 * Prod backfill via RDS Data API (no VPC required).
 * Usage: node scripts/backfill-meal-refund-case-prod-rds-data.js ML2606034189
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ORDER_REF = process.argv[2] || 'ML2606034189';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function execSql(sql, formatRecordsAs) {
  const clusterArn = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ${REGION} --query DBClusters[0].DBClusterArn --output text`,
    { encoding: 'utf8' },
  ).trim();
  const secretArn = execSync(
    `aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ${REGION} --query ARN --output text`,
    { encoding: 'utf8' },
  ).trim();
  const inputFile = path.join(__dirname, `_tmp_backfill_${Date.now()}.json`);
  const payload = {
    resourceArn: clusterArn,
    secretArn,
    database: 'warmpawz',
    sql,
  };
  if (formatRecordsAs) payload.formatRecordsAs = formatRecordsAs;
  fs.writeFileSync(inputFile, JSON.stringify(payload));
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    return JSON.parse(out);
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function parseRecords(parsed) {
  let records = parsed.formattedRecords;
  if (typeof records === 'string') records = JSON.parse(records);
  if (!Array.isArray(records)) return [];
  return records.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}

function main() {
  const sel = execSql(
    `SELECT mo.id::text AS id, mo.order_number, mo.status, mo.payment_status, mo.cancelled_by,
            mo.total_amount::text AS total_amount, mo.cancellation_reason,
            mo.pidge_order_id,
            p.amount::text AS payment_amount
     FROM meal_orders mo
     LEFT JOIN delivery_tracking dt ON dt.meal_order_id = mo.id
     LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
       AND p.payment_status IN ('completed', 'paid')
     WHERE mo.order_number = '${ORDER_REF.replace(/'/g, "''")}'
     LIMIT 1`,
    'JSON',
  );
  const rows = parseRecords(sel);
  if (!rows.length) {
    console.error('Order not found');
    process.exit(1);
  }
  const o = rows[0];
  console.log('Order:', o);
  if (String(o.status).toLowerCase() !== 'cancelled') {
    console.error('Not cancelled');
    process.exit(1);
  }
  const ps = String(o.payment_status || '').toLowerCase();
  const paid =
    ps === 'paid' ||
    ps === 'completed' ||
    (parseFloat(o.payment_amount || '0') > 0);
  if (!paid) {
    console.error('Not paid — payment_status=', o.payment_status);
    process.exit(1);
  }
  const paidTotal =
    parseFloat(o.payment_amount || '0') || parseFloat(o.total_amount || '0') || 0;
  const recommend =
    o.cancelled_by === 'system_pidge' ? paidTotal : 0;
  const reason =
    o.cancelled_by === 'system_pidge'
      ? 'Pidge logistics cancelled before pickup/delivery; recommend 100% of customer-paid total.'
      : 'Manual backfill; review required.';

  const ins = execSql(
    `INSERT INTO meal_refund_cases (
       meal_order_id, pidge_order_id, status, cancellation_source, cancellation_reason,
       recommended_refund_amount, recommendation_reason, notification_dedupe_key,
       created_at, updated_at
     ) VALUES (
       '${String(o.id).replace(/'/g, "''")}'::uuid,
       ${o.pidge_order_id ? `'${String(o.pidge_order_id).replace(/'/g, "''")}'` : 'NULL'},
       'pending_review', 'system_pidge',
       '${String(o.cancellation_reason || 'Pidge cancel (backfill)').replace(/'/g, "''")}',
       ${recommend}, '${reason.replace(/'/g, "''")}',
       'meal_refund_case:${String(o.id).replace(/'/g, "''")}',
       NOW(), NOW()
     )
     ON CONFLICT (meal_order_id) DO NOTHING
     RETURNING id::text`,
    'JSON',
  );
  const created = parseRecords(ins);
  if (created.length) {
    console.log('Created case id:', created[0].id);
  } else {
    const ex = execSql(
      `SELECT id::text, status FROM meal_refund_cases WHERE meal_order_id = '${String(o.id).replace(/'/g, "''")}'::uuid`,
      'JSON',
    );
    console.log('Already exists:', parseRecords(ex)[0]);
  }
}

main();

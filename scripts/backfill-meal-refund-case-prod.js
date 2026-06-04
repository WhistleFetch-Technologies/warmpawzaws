#!/usr/bin/env node
/**
 * One-off prod backfill: meal_refund_cases for cancelled paid meal order.
 * Usage: node scripts/backfill-meal-refund-case-prod.js ML2606034189
 */
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ORDER_REF = process.argv[2] || 'ML2606034189';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const ENVIRONMENT = 'prod';

async function main() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' },
    ),
  ).DBClusters[0];
  const endpoint =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com'
      : clusterInfo.Endpoint;
  const secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  const secret = JSON.parse(
    (
      await new SecretsManagerClient({ region: REGION }).send(
        new GetSecretValueCommand({ SecretId: secretName }),
      )
    ).SecretString,
  );
  const pool = new Pool({
    host: endpoint,
    port: 5432,
    database: clusterInfo.DatabaseName || 'warmpawz',
    user: clusterInfo.MasterUsername || 'warmpawz_admin',
    password: secret.password || secret.Password,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  const orderRes = await pool.query(
    `SELECT mo.id, mo.order_number, mo.status, mo.payment_status, mo.cancelled_by,
            mo.total_amount, mo.picked_up_at, mo.delivered_at, mo.cancellation_reason,
            dt.pidge_order_id, dt.status AS tracking_status,
            p.amount AS payment_amount,
            phe.id AS webhook_event_id
     FROM meal_orders mo
     LEFT JOIN delivery_tracking dt ON dt.meal_order_id = mo.id
     LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
       AND p.payment_status IN ('completed', 'paid')
     LEFT JOIN LATERAL (
       SELECT id FROM pidge_hyperlocal_webhook_events
       WHERE meal_order_id = mo.id AND event_kind = 'meal_cancelled'
       ORDER BY created_at DESC LIMIT 1
     ) phe ON true
     WHERE mo.order_number = $1 OR mo.id::text = $1
     LIMIT 1`,
    [ORDER_REF],
  );
  if (!orderRes.rows.length) {
    console.error('Order not found:', ORDER_REF);
    process.exit(1);
  }
  const o = orderRes.rows[0];
  console.log('Order:', {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    payment_status: o.payment_status,
    cancelled_by: o.cancelled_by,
    payment_amount: o.payment_amount,
  });

  if (String(o.status).toLowerCase() !== 'cancelled') {
    console.error('Order is not cancelled');
    process.exit(1);
  }
  const ps = String(o.payment_status || '').toLowerCase();
  const paid =
    ps === 'paid' ||
    ps === 'completed' ||
    (o.payment_amount != null && parseFloat(o.payment_amount) > 0);
  if (!paid) {
    console.error('Order is not paid');
    process.exit(1);
  }

  const paidTotal = parseFloat(o.payment_amount || o.total_amount || '0') || 0;
  const tracking = String(o.tracking_status || '').toLowerCase();
  const neverDelivered =
    !o.delivered_at &&
    !o.picked_up_at &&
    (!tracking || !['delivered', 'picked_up'].includes(tracking));
  const recommend =
    o.cancelled_by === 'system_pidge' && neverDelivered
      ? paidTotal
      : 0;
  const reason =
    o.cancelled_by === 'system_pidge' && neverDelivered
      ? 'Pidge logistics cancelled before pickup/delivery; recommend 100% of customer-paid total.'
      : 'No automatic full-refund rule matched; manual review required.';

  const ins = await pool.query(
    `INSERT INTO meal_refund_cases (
       meal_order_id, pidge_order_id, status, cancellation_source, cancellation_reason,
       recommended_refund_amount, recommendation_reason, pidge_webhook_event_id,
       notification_dedupe_key, created_at, updated_at
     ) VALUES ($1, $2, 'pending_review', 'system_pidge', $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (meal_order_id) DO NOTHING
     RETURNING id`,
    [
      o.id,
      o.pidge_order_id,
      o.cancellation_reason || 'Pidge logistics cancellation (admin backfill)',
      recommend,
      reason,
      o.webhook_event_id,
      `meal_refund_case:${o.id}`,
    ],
  );
  if (ins.rows.length) {
    console.log('Created meal_refund_cases id:', ins.rows[0].id);
  } else {
    const existing = await pool.query(
      `SELECT id, status FROM meal_refund_cases WHERE meal_order_id = $1`,
      [o.id],
    );
    console.log('Case already exists:', existing.rows[0]);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

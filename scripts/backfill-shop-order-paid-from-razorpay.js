#!/usr/bin/env node
/**
 * Backfill a shop order marked cancelled/expired when Razorpay shows captured payment.
 * Uses reconcileShopOrderPayment (Tier 1 DB + Tier 2 Razorpay API) from lambda utils.
 *
 * Usage (dry-run — lookup only):
 *   ENVIRONMENT=prod node scripts/backfill-shop-order-paid-from-razorpay.js --order-number ORD-1785393914492-527
 *
 * Usage (apply — run AFTER backend deploy with reconciliation code):
 *   ENVIRONMENT=prod APPLY=YES node scripts/backfill-shop-order-paid-from-razorpay.js --order-number ORD-1785393914492-527
 *
 * Also accepts --order-id <uuid>.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.env.APPLY === 'YES';

const pgPath = path.join(__dirname, '..', 'backend', 'lambda', 'node_modules', 'pg');
const { Pool } = require(pgPath);

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

async function getDbConfig() {
  const { execSync: exec } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    exec(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const port = cluster.Port || 5432;
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;

  return { endpoint, port, dbName, username, password };
}

async function lookupOrder(pool, { orderNumber, orderId }) {
  const sql = orderId
    ? `SELECT o.id::text, o.order_number, o.order_status, o.payment_status, o.cancellation_reason,
              o.cancelled_at::text, p.id::text AS payment_id, p.payment_status AS pay_row_status,
              p.razorpay_order_id, p.razorpay_payment_id
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT * FROM payments pp
         WHERE pp.order_id = o.id AND pp.booking_id IS NULL AND pp.pharmacy_order_id IS NULL
         ORDER BY pp.created_at DESC LIMIT 1
       ) p ON TRUE
       WHERE o.id = $1::uuid
       LIMIT 1`
    : `SELECT o.id::text, o.order_number, o.order_status, o.payment_status, o.cancellation_reason,
              o.cancelled_at::text, p.id::text AS payment_id, p.payment_status AS pay_row_status,
              p.razorpay_order_id, p.razorpay_payment_id
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT * FROM payments pp
         WHERE pp.order_id = o.id AND pp.booking_id IS NULL AND pp.pharmacy_order_id IS NULL
         ORDER BY pp.created_at DESC LIMIT 1
       ) p ON TRUE
       WHERE o.order_number = $1
       LIMIT 1`;
  const params = [orderId || orderNumber];
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

function runReconcile(orderId, dbEnv) {
  const lambdaRoot = path.join(__dirname, '..', 'backend', 'lambda');
  const runnerPath = path.join(__dirname, '_tmp_backfill_shop_reconcile.ts');
  const runner = `
import { reconcileShopOrderPayment } from './src/utils/payments/shop-payment-reconciliation';

reconcileShopOrderPayment('${orderId}', { source: 'backfill-script' })
  .then((ok) => {
    console.log(JSON.stringify({ reconciled: ok }));
    process.exit(ok ? 0 : 2);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
`;
  fs.writeFileSync(runnerPath, runner, 'utf8');
  try {
    const out = execSync(`npx ts-node --transpile-only "${runnerPath}"`, {
      cwd: lambdaRoot,
      env: { ...process.env, ...dbEnv, ENVIRONMENT },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    console.log(out.trim());
    const parsed = JSON.parse(out.trim().split('\n').pop());
    return parsed.reconciled === true;
  } finally {
    try {
      fs.unlinkSync(runnerPath);
    } catch (_) {}
  }
}

async function main() {
  const orderNumber = parseArg('--order-number');
  const orderId = parseArg('--order-id');
  if (!orderNumber && !orderId) {
    console.error('Provide --order-number ORD-... or --order-id <uuid>');
    process.exit(1);
  }

  console.log('============================================================================');
  console.log('Shop order paid backfill (Razorpay reconcile)');
  console.log(`Environment: ${ENVIRONMENT}  Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('============================================================================\n');

  const dbConfig = await getDbConfig();
  const pool = new Pool({
    host: dbConfig.endpoint,
    port: dbConfig.port,
    database: dbConfig.dbName,
    user: dbConfig.username,
    password: dbConfig.password,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const row = await lookupOrder(pool, { orderNumber, orderId });
    if (!row) {
      console.error('Order not found');
      process.exit(1);
    }

    console.log('Current state:');
    console.log(JSON.stringify(row, null, 2));
    console.log('');

    const ps = String(row.payment_status || '').toLowerCase();
    if (ps === 'paid' || ps === 'completed') {
      console.log('Order already paid — nothing to do.');
      return;
    }

    if (!APPLY) {
      console.log('DRY-RUN: pass APPLY=YES to run reconcileShopOrderPayment (after backend deploy).');
      return;
    }

    const dbEnv = {
      DB_HOST: dbConfig.endpoint,
      DB_PORT: String(dbConfig.port),
      DB_NAME: dbConfig.dbName,
      DB_USER: dbConfig.username,
      DB_PASSWORD: dbConfig.password,
      AWS_REGION: REGION,
    };

    console.log(`Reconciling order ${row.id}...`);
    const reconciled = runReconcile(row.id, dbEnv);
    if (!reconciled) {
      console.error('Reconcile returned false — check Razorpay order status and payment row.');
      process.exit(2);
    }

    const after = await lookupOrder(pool, { orderId: row.id });
    console.log('\nAfter reconcile:');
    console.log(JSON.stringify(after, null, 2));
    console.log('\nDone — no refund initiated.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Zero every customer INR wallet (customer_wallets.balance + customers.wallet_balance).
 * Writes one audit debit per non-zero wallet. Does not touch vendor_wallets.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/zero-customer-wallets.js
 *   ENVIRONMENT=dev node scripts/zero-customer-wallets.js --apply --yes
 *   ENVIRONMENT=prod node scripts/zero-customer-wallets.js
 *   ENVIRONMENT=prod node scripts/zero-customer-wallets.js --apply --yes
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = (process.env.ENVIRONMENT || '').toLowerCase();
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const RESET_LABEL = `Loyalty pause reset ${new Date().toISOString().slice(0, 10)}`;

function parseArgsOk() {
  if (ENVIRONMENT !== 'dev' && ENVIRONMENT !== 'prod') {
    console.error('Set ENVIRONMENT=dev or ENVIRONMENT=prod');
    process.exit(1);
  }
  if (APPLY && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(1);
  }
}

async function connectPool() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters?.[0];
  if (!cluster) {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }

  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  if (!password) {
    throw new Error('Password not found in secret');
  }

  const pool = new Pool({
    host: endpoint,
    port: parseInt(String(port), 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 1,
  });

  await pool.query('SELECT 1');
  return { pool, endpoint, dbName };
}

async function columnSet(pool, table) {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function printDryRun(pool) {
  const wallets = await pool.query(`
    SELECT
      COUNT(*)::int AS wallet_rows,
      COUNT(*) FILTER (WHERE COALESCE(balance, 0) <> 0)::int AS nonzero_wallets,
      COALESCE(SUM(balance), 0)::numeric AS sum_wallet_balance
    FROM customer_wallets
  `);

  const custCols = await columnSet(pool, 'customers');
  const hasMirror = custCols.has('wallet_balance');
  const customers = hasMirror
    ? await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(wallet_balance, 0) <> 0)::int AS nonzero_customer_mirrors,
          COALESCE(SUM(wallet_balance), 0)::numeric AS sum_customer_wallet_balance
        FROM customers
      `)
    : { rows: [{ nonzero_customer_mirrors: 0, sum_customer_wallet_balance: 0 }] };

  const wtCols = await columnSet(pool, 'wallet_transactions');
  const hasSource = wtCols.has('source');
  const splitSql = hasSource
    ? `
      SELECT
        CASE
          WHEN COALESCE(source, '') IN ('loyalty_redeem', 'loyalty_reward', 'loyalty_points')
            OR description ILIKE '%loyalty%'
            OR description ILIKE '%points%'
            THEN 'loyalty_like'
          WHEN COALESCE(source, '') ILIKE '%refund%'
            OR description ILIKE '%refund%'
            THEN 'refund_like'
          ELSE 'other'
        END AS kind,
        COUNT(*)::int AS txn_count,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(transaction_type::text)) IN ('credit', 'refund') THEN amount ELSE 0 END), 0)::numeric AS credit_sum
      FROM wallet_transactions
      GROUP BY 1
      ORDER BY 1
    `
    : `
      SELECT
        CASE
          WHEN description ILIKE '%loyalty%' OR description ILIKE '%points%' THEN 'loyalty_like'
          WHEN description ILIKE '%refund%' THEN 'refund_like'
          ELSE 'other'
        END AS kind,
        COUNT(*)::int AS txn_count,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(transaction_type::text)) IN ('credit', 'refund') THEN amount ELSE 0 END), 0)::numeric AS credit_sum
      FROM wallet_transactions
      GROUP BY 1
      ORDER BY 1
    `;

  const split = await pool.query(splitSql);
  const points = await pool.query(`
    SELECT
      COUNT(*)::int AS loyalty_rows,
      COALESCE(SUM(total_points), 0)::numeric AS sum_points,
      COALESCE(SUM(lifetime_points_redeemed), 0)::numeric AS sum_redeemed
    FROM customer_loyalty_points
  `);

  const w = wallets.rows[0];
  const c = customers.rows[0];
  const p = points.rows[0];

  console.log('');
  console.log('=== DRY-RUN: customer INR wallets ===');
  console.log(`environment: ${ENVIRONMENT}`);
  console.log(`wallet_rows: ${w.wallet_rows}`);
  console.log(`nonzero_wallets: ${w.nonzero_wallets}`);
  console.log(`sum_customer_wallets.balance: ${w.sum_wallet_balance}`);
  console.log(`nonzero_customers.wallet_balance: ${c.nonzero_customer_mirrors}`);
  console.log(`sum_customers.wallet_balance: ${c.sum_customer_wallet_balance}`);
  console.log(`loyalty_rows: ${p.loyalty_rows}`);
  console.log(`sum_loyalty_total_points: ${p.sum_points}`);
  console.log(`sum_loyalty_lifetime_redeemed: ${p.sum_redeemed}`);
  console.log('wallet_transactions credit split:');
  for (const row of split.rows) {
    console.log(`  ${row.kind}: count=${row.txn_count} credit_sum=${row.credit_sum}`);
  }
  console.log('');
  console.log('APPLY will set every customer INR wallet to 0, including refunds and top-ups.');
  return {
    nonzeroWallets: Number(w.nonzero_wallets || 0),
    sumWallet: String(w.sum_wallet_balance || '0'),
    sumMirror: String(c.sum_customer_wallet_balance || '0'),
  };
}

async function applyWipe(pool) {
  const wtCols = await columnSet(pool, 'wallet_transactions');
  const cwCols = await columnSet(pool, 'customer_wallets');
  const custCols = await columnSet(pool, 'customers');

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    const wallets = await client.query(
      `SELECT id, customer_id, balance
       FROM customer_wallets
       WHERE COALESCE(balance, 0) <> 0
       FOR UPDATE`
    );

    for (const row of wallets.rows) {
      const bal = Number(row.balance || 0);
      if (!Number.isFinite(bal) || bal === 0) continue;

      const insertCols = [];
      const insertVals = [];
      if (wtCols.has('wallet_id')) {
        insertCols.push('wallet_id');
        insertVals.push(row.id);
      }
      if (wtCols.has('customer_id')) {
        insertCols.push('customer_id');
        insertVals.push(row.customer_id);
      }
      insertCols.push('transaction_type', 'amount', 'balance_after', 'description');
      insertVals.push('debit', Math.abs(bal), 0, RESET_LABEL);
      if (wtCols.has('source')) {
        insertCols.push('source');
        insertVals.push('loyalty_pause_reset');
      }

      const ph = insertVals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${ph})`,
        insertVals
      );

      const setBal = cwCols.has('updated_at')
        ? 'SET balance = 0, updated_at = NOW()'
        : 'SET balance = 0';
      await client.query(`UPDATE customer_wallets ${setBal} WHERE id = $1`, [row.id]);

      if (custCols.has('wallet_balance')) {
        await client.query(`UPDATE customers SET wallet_balance = 0 WHERE id = $1`, [row.customer_id]);
      }
      updated += 1;
    }

    if (custCols.has('wallet_balance')) {
      await client.query(
        `UPDATE customers SET wallet_balance = 0
         WHERE COALESCE(wallet_balance, 0) <> 0`
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return updated;
}

async function main() {
  parseArgsOk();
  console.log(`zero-customer-wallets env=${ENVIRONMENT} apply=${APPLY} yes=${YES}`);
  const { pool, endpoint, dbName } = await connectPool();
  console.log(`connected ${endpoint} / ${dbName}`);
  try {
    const summary = await printDryRun(pool);
    if (!APPLY) {
      console.log('Dry-run only. Re-run with --apply --yes to write.');
      return;
    }
    if (ENVIRONMENT === 'prod' && !YES) {
      console.error('Prod apply refused without --yes');
      process.exit(1);
    }
    console.log(
      `APPLYING wipe: nonzero_wallets=${summary.nonzeroWallets} sum=${summary.sumWallet} mirror=${summary.sumMirror}`
    );
    const n = await applyWipe(pool);
    console.log(`APPLY_OK wallets_debited=${n}`);
    await printDryRun(pool);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

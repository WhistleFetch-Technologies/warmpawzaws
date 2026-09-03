/**
 * Zero customer INR wallets via RDS Data API (when direct Postgres is blocked).
 *
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/zero-customer-wallets-rds-data-api.js
 *   $env:ENVIRONMENT='dev'; node scripts/zero-customer-wallets-rds-data-api.js --apply --yes
 *   $env:ENVIRONMENT='prod'; node scripts/zero-customer-wallets-rds-data-api.js
 *   $env:ENVIRONMENT='prod'; node scripts/zero-customer-wallets-rds-data-api.js --apply --yes
 */
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = (process.env.ENVIRONMENT || '').toLowerCase();
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const RESET_LABEL = `Loyalty pause reset ${new Date().toISOString().slice(0, 10)}`;

function requireEnv() {
  if (ENVIRONMENT !== 'dev' && ENVIRONMENT !== 'prod') {
    console.error('Set ENVIRONMENT=dev or ENVIRONMENT=prod');
    process.exit(1);
  }
  if (APPLY && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(1);
  }
}

function num(row, ...keys) {
  for (const k of keys) {
    if (row && row[k] != null) return Number(row[k]);
  }
  return 0;
}

async function tableColumns(table) {
  const cols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${table.replace(/'/g, "''")}'
  `);
  return new Set((cols || []).map((c) => String(c.column_name || c.columnname || '')));
}

async function printDryRun() {
  const wallets = await query(`
    SELECT
      COUNT(*)::int AS wallet_rows,
      COUNT(*) FILTER (WHERE COALESCE(balance, 0) <> 0)::int AS nonzero_wallets,
      COALESCE(SUM(balance), 0)::numeric AS sum_wallet_balance
    FROM customer_wallets
  `);
  const custCols = await tableColumns('customers');
  const hasMirror = custCols.has('wallet_balance');
  const customers = hasMirror
    ? await query(`
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(wallet_balance, 0) <> 0)::int AS nonzero_customer_mirrors,
          COALESCE(SUM(wallet_balance), 0)::numeric AS sum_customer_wallet_balance
        FROM customers
      `)
    : [{ nonzero_customer_mirrors: 0, sum_customer_wallet_balance: 0 }];
  const points = await query(`
    SELECT
      COUNT(*)::int AS loyalty_rows,
      COALESCE(SUM(total_points), 0)::numeric AS sum_points,
      COALESCE(SUM(lifetime_points_redeemed), 0)::numeric AS sum_redeemed
    FROM customer_loyalty_points
  `);

  const cols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
  `);
  const colNames = (cols || []).map((c) => String(c.column_name || c.columnname || ''));
  const hasSource = colNames.includes('source');

  const split = await query(
    hasSource
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
      `
  );

  const w = wallets?.[0] || {};
  const c = customers?.[0] || {};
  const p = points?.[0] || {};

  console.log('');
  console.log('=== DRY-RUN: customer INR wallets ===');
  console.log(`environment: ${ENVIRONMENT}`);
  console.log(`wallet_rows: ${num(w, 'wallet_rows', 'walletrows')}`);
  console.log(`nonzero_wallets: ${num(w, 'nonzero_wallets', 'nonzerowallets')}`);
  console.log(`sum_customer_wallets.balance: ${w.sum_wallet_balance ?? w.sumwalletbalance ?? 0}`);
  console.log(`customers.wallet_balance column: ${hasMirror ? 'present' : 'absent (source of truth is customer_wallets)'}`);
  console.log(`nonzero_customers.wallet_balance: ${num(c, 'nonzero_customer_mirrors', 'nonzerocustomermirrors')}`);
  console.log(`sum_customers.wallet_balance: ${c.sum_customer_wallet_balance ?? c.sumcustomerwalletbalance ?? 0}`);
  console.log(`loyalty_rows: ${num(p, 'loyalty_rows', 'loyaltyrows')}`);
  console.log(`sum_loyalty_total_points: ${p.sum_points ?? p.sumpoints ?? 0}`);
  console.log(`sum_loyalty_lifetime_redeemed: ${p.sum_redeemed ?? p.sumredeemed ?? 0}`);
  console.log('wallet_transactions credit split:');
  for (const row of split || []) {
    console.log(`  ${row.kind}: count=${row.txn_count ?? row.txncount} credit_sum=${row.credit_sum ?? row.creditsum}`);
  }
  console.log('');
  console.log('APPLY will set every customer INR wallet to 0, including refunds and top-ups.');
  return { hasSource, hasMirror, wtCols: new Set(colNames) };
}

async function applyWipe(hasSource, hasMirror, wtCols) {
  const insertCols = [];
  if (wtCols.has('wallet_id')) insertCols.push('wallet_id');
  if (wtCols.has('customer_id')) insertCols.push('customer_id');
  insertCols.push('transaction_type', 'amount', 'balance_after', 'description');
  if (hasSource) insertCols.push('source');

  const insertVals = [];
  if (wtCols.has('wallet_id')) insertVals.push('r.id');
  if (wtCols.has('customer_id')) insertVals.push('r.customer_id');
  insertVals.push("'debit'", 'ABS(r.balance)', '0', `'${RESET_LABEL.replace(/'/g, "''")}'`);
  if (hasSource) insertVals.push("'loyalty_pause_reset'");

  const mirrorPerWallet = hasMirror
    ? `
    UPDATE customers
    SET wallet_balance = 0
    WHERE id = r.customer_id;`
    : '';
  const mirrorTail = hasMirror
    ? `
  UPDATE customers
  SET wallet_balance = 0
  WHERE COALESCE(wallet_balance, 0) <> 0;`
    : '';
  const sql = `
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, customer_id, balance
    FROM customer_wallets
    WHERE COALESCE(balance, 0) <> 0
  LOOP
    INSERT INTO wallet_transactions
      (${insertCols.join(', ')})
    VALUES
      (${insertVals.join(', ')});

    UPDATE customer_wallets
    SET balance = 0, updated_at = NOW()
    WHERE id = r.id;
    ${mirrorPerWallet}
  END LOOP;
  ${mirrorTail}
END $$;
`;
  await executeSQL(sql, false);
}

async function main() {
  requireEnv();
  console.log(`zero-customer-wallets-data-api env=${ENVIRONMENT} apply=${APPLY} yes=${YES}`);
  const { hasSource, hasMirror, wtCols } = await printDryRun();
  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply --yes to write.');
    return;
  }
  if (ENVIRONMENT === 'prod' && !YES) {
    console.error('Prod apply refused without --yes');
    process.exit(1);
  }
  console.log('APPLYING wipe via RDS Data API...');
  await applyWipe(hasSource, hasMirror, wtCols);
  console.log('APPLY_OK');
  await printDryRun();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

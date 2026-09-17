/**
 * Apply Promotion Engine migrations 1111–1114 on DEV via RDS Data API.
 * Usage (PowerShell): $env:ENVIRONMENT='dev'; node scripts/run-migration-1111-1114-rds-data-api-dev.js
 *
 * Refuses prod. Additive / idempotent only.
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const FILES = [
  '1111_promotion_engine_core.sql',
  '1112_customer_behaviour_profiles.sql',
  '1113_wallet_promo_cashback_ledger.sql',
  '1114_promotion_engine_eval_audit.sql',
];

async function runFile(filename) {
  const filePath = path.join(__dirname, '..', 'db', 'migrations', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`\n=== ${filename} (${stmts.length} statements) ===`);
  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 120);
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 120 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }
  return stmts.length;
}

async function verify() {
  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'promo_engine_promotions',
        'promo_engine_rules',
        'promo_engine_limits',
        'promo_engine_usage',
        'customer_behaviour_profiles',
        'customer_behaviour_events',
        'promo_engine_evaluations',
        'promo_engine_audit_log'
      )
    ORDER BY table_name
  `);
  const walletCols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wallet_transactions'
      AND column_name IN (
        'promotion_id', 'source', 'remaining_amount', 'earned_at',
        'expires_at', 'cashback_status', 'redeem_scope'
      )
    ORDER BY column_name
  `);
  const tableNames = tables.map((r) => r.table_name || r.tablename || r[0]);
  const colNames = walletCols.map((r) => r.column_name || r.columnname || r[0]);
  console.log('VERIFY_TABLES', tableNames.join(', '));
  console.log('VERIFY_WALLET_COLUMNS', colNames.join(', '));
  const expectedTables = [
    'customer_behaviour_events',
    'customer_behaviour_profiles',
    'promo_engine_audit_log',
    'promo_engine_evaluations',
    'promo_engine_limits',
    'promo_engine_promotions',
    'promo_engine_rules',
    'promo_engine_usage',
  ];
  const missingTables = expectedTables.filter((t) => !tableNames.includes(t));
  const expectedCols = [
    'cashback_status',
    'earned_at',
    'expires_at',
    'promotion_id',
    'redeem_scope',
    'remaining_amount',
    'source',
  ];
  const missingCols = expectedCols.filter((c) => !colNames.includes(c));
  if (missingTables.length || missingCols.length) {
    throw new Error(
      `Verify failed. missing tables=${missingTables.join(',') || 'none'} missing wallet cols=${missingCols.join(',') || 'none'}`,
    );
  }
}

async function main() {
  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (env !== 'dev') {
    console.error('This script is DEV-only. Set ENVIRONMENT=dev and retry.');
    process.exit(1);
  }

  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log('Environment: dev');
  console.log('Cluster: warmpawz-dev-cluster');
  console.log('Applying 1111–1114 via RDS Data API\n');

  let total = 0;
  for (const file of FILES) {
    total += await runFile(file);
  }
  console.log(`TOTAL_STATEMENTS=${total}`);
  await verify();
  console.log('Migrations 1111–1114 complete on DEV.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Apply migration 1130 on ENVIRONMENT (dev|prod) via RDS Data API.
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/run-migration-1130-rds-data-api.js
 *   $env:ENVIRONMENT='prod'; node scripts/run-migration-1130-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

async function main() {
  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (env !== 'prod' && env !== 'dev') {
    console.error("Set ENVIRONMENT=prod (or dev) before running this script.");
    process.exit(1);
  }

  const migrationFile = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '1130_wpay_catalogue_require_bill.sql',
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1130 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 180).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 180 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const cols = await query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warmpawz_pay_vendor_catalog'
      AND column_name = 'require_bill'
  `);
  console.log('verify require_bill:', cols);

  const sample = await query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE require_bill = true)::int AS require_bill_true
    FROM warmpawz_pay_vendor_catalog
  `);
  console.log('catalogue counts:', sample);
  console.log(`Migration 1130 complete on ${env}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

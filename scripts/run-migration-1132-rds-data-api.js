/**
 * Apply migration 1132 on ENVIRONMENT (dev|prod) via RDS Data API.
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/run-migration-1132-rds-data-api.js
 *   $env:ENVIRONMENT='prod'; node scripts/run-migration-1132-rds-data-api.js
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
    '1132_vendor_legal_acceptances.sql',
  );
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1132 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const verify = await query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'vendor_legal_acceptances'
      AND c.relkind = 'r'
  `);
  console.log('verify table:', verify);

  const indexes = await query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vendor_legal_acceptances'
    ORDER BY indexname
  `);
  console.log('indexes:', indexes);
  console.log(`Migration 1132 complete on ${env}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Run migration 1086 on the environment in ENVIRONMENT (prod|dev) via RDS Data API.
 * Usage (PowerShell): $env:ENVIRONMENT='prod'; node scripts/run-migration-1086-rds-data-api.js
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
    '1086_vendor_earnings_booking_id_unique.sql'
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1086 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const verify = await query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_vendor_earnings_booking_id_unique'
  `);
  console.log('VERIFY_INDEX', JSON.stringify(verify));
  if (!verify || verify.length === 0) {
    throw new Error('Unique index idx_vendor_earnings_booking_id_unique was not found after migration');
  }
  console.log('Migration 1086 complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

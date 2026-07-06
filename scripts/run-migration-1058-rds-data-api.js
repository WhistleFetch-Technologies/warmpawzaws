#!/usr/bin/env node
/**
 * Run migration 1058 on dev/prod via RDS Data API.
 * Usage: ENVIRONMENT=dev|prod node scripts/run-migration-1058-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1058_vendor_earnings_settlement_metadata.sql');

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1058 — ${stmts.length} statement(s) on ${env}\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const cols = await query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'vendor_earnings' AND column_name = 'metadata'`
  );
  console.log('\nVerify column:', cols);
  console.log('\nMigration 1058 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

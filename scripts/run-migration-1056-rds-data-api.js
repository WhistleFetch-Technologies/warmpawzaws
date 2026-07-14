#!/usr/bin/env node
/**
 * Run migration 1056 on dev/prod via RDS Data API.
 * Usage: ENVIRONMENT=dev|prod node scripts/run-migration-1056-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1056_promotions_max_uses_columns.sql');

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1056 — ${stmts.length} statement(s) on ${env}\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const cols = await query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'promotions'
       AND column_name IN ('max_uses', 'max_uses_per_user', 'usage_limit')
     ORDER BY 1`
  );
  console.log('\nVerify columns:', cols);
  console.log('\nMigration 1056 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

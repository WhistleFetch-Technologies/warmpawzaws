#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1069_coupons_service_targeting.sql');

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1069 — ${stmts.length} statement(s) on ${env}\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const cols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'coupons'
      AND column_name IN ('applicable_to', 'service_category', 'applicable_services', 'metadata')
    ORDER BY 1
  `);
  console.log('\nVerified coupon columns:', cols);
  console.log('\nMigration 1069 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

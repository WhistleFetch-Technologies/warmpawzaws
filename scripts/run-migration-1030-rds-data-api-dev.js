#!/usr/bin/env node
/**
 * Run migration 1030 on dev via RDS Data API (statement-by-statement).
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1030_service_promotions_platform_alignment.sql');

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1030 — ${stmts.length} statement(s) on dev\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'promotions'
       AND column_name IN ('service_category', 'metadata', 'published')
     ORDER BY 1`
  );
  console.log('\nVerify columns:', cols);

  const idx = await query(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'promotions' AND indexname = 'idx_promotions_customer_active'`
  );
  console.log('Verify index:', idx);
  console.log('\nMigration 1030 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

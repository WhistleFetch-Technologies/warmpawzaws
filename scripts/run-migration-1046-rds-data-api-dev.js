#!/usr/bin/env node
/**
 * Run migration 1046 on dev via RDS Data API (statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1046-rds-data-api-dev.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1046_commercial_discount_campaigns.sql');

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1046 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'}\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const tables = await query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename IN (
         'commercial_discount_campaigns',
         'commercial_campaign_promotion_links',
         'commercial_campaign_audit_log'
       )
     ORDER BY 1`
  );
  console.log('\nVerify tables:', tables);
  console.log('\nMigration 1046 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

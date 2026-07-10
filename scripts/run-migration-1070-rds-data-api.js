#!/usr/bin/env node
/**
 * Run migration 1070 via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev|prod node scripts/run-migration-1070-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1070_promotions_coupons_discount_domain.sql'
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1070 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 120).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const cols = await query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'discount_domain'
      AND table_name IN ('promotions', 'coupons')
    ORDER BY table_name
  `);
  console.log('\nVerified columns:', cols);
  console.log('\nMigration 1070 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

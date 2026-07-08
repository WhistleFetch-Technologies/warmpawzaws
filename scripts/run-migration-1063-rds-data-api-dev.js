#!/usr/bin/env node
/**
 * Run migration 1063 on dev via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1063-rds-data-api-dev.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1063_promotions_coupons_discount_domain.sql'
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1063 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`
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

  const checks = await query(`
    SELECT conname, conrelid::regclass::text AS table_name
    FROM pg_constraint
    WHERE conname IN ('promotions_discount_domain_check', 'coupons_discount_domain_check')
    ORDER BY 1
  `);
  console.log('Verified checks:', checks);

  const indexes = await query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('idx_promotions_discount_domain', 'idx_coupons_discount_domain')
    ORDER BY 1
  `);
  console.log('Verified indexes:', indexes);

  console.log('\nMigration 1063 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

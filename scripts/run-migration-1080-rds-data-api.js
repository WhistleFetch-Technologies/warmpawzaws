#!/usr/bin/env node
/**
 * Run migration 1080 on dev/prod via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1080-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1080_warmpawz_pay_phase1_schema.sql'
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1080 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 120).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const paymentCols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN ('payment_source', 'original_amount', 'metadata')
    ORDER BY 1
  `);
  console.log('\nVerified payments columns:', paymentCols);

  const vendorCols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name IN ('pay_bill_enabled', 'bank_verified')
    ORDER BY 1
  `);
  console.log('Verified vendors columns:', vendorCols);

  const catalog = await query(`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'warmpawz_pay_vendor_catalog'
  `);
  console.log('Verified warmpawz_pay_vendor_catalog:', catalog);

  const indexes = await query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_payments_wpay_idempotency',
        'idx_settlements_wpay_payment_unique',
        'idx_wpay_catalog_vendor_id'
      )
    ORDER BY 1
  `);
  console.log('Verified wpay indexes:', indexes);

  console.log('\nMigration 1080 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

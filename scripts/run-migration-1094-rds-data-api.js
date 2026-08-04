#!/usr/bin/env node
/**
 * Run migration 1094 on dev/prod via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1094-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1094_warmpawz_pay_appointment_credits.sql',
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1094 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`,
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 120).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const table = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warmpawz_pay_appointment_credits'
    ORDER BY ordinal_position
  `);
  console.log('\nVerified columns:');
  console.log(JSON.stringify(table, null, 2));

  const index = await query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'warmpawz_pay_appointment_credits'
      AND indexname = 'idx_wpay_appointment_credits_payment_id'
  `);
  console.log('\nVerified index:');
  console.log(JSON.stringify(index, null, 2));

  console.log('\nMigration 1094 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

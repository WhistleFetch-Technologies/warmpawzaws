#!/usr/bin/env node
/**
 * Run migration 1093 on dev/prod via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1093-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1095_warmpawz_pay_platform_withhold.sql',
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1095 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`,
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 120).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const column = await query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warmpawz_pay_merchant_pricing'
      AND column_name = 'platform_withhold_percent'
  `);
  console.log('\nVerified column:');
  console.log(JSON.stringify(column, null, 2));

  const constraint = await query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_merchant_pricing'::regclass
      AND conname = 'warmpawz_pay_merchant_pricing_platform_withhold_percent_check'
  `);
  console.log('\nVerified CHECK constraint:');
  console.log(JSON.stringify(constraint, null, 2));

  console.log('\nMigration 1095 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

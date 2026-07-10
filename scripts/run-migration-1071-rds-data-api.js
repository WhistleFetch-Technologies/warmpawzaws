#!/usr/bin/env node
/**
 * Run migration 1071 on env via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev|prod node scripts/run-migration-1071-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1071_commercial_campaigns_discount_domain_budget.sql'
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1071 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 100).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const cols = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'commercial_discount_campaigns'
      AND column_name IN ('discount_domain','surface','budget_cap','budget_spent','goal','objective')
    ORDER BY 1
  `);
  console.log('\nVerified campaign columns:', cols);
  console.log('Migration 1071 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

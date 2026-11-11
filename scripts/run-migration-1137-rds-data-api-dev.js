#!/usr/bin/env node
/**
 * Apply migration 1137 on DEV via RDS Data API (statement-by-statement).
 * Usage: $env:ENVIRONMENT='dev'; node scripts/run-migration-1137-rds-data-api-dev.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const FILE = '1137_hdfc_paws_n_claws_self_serve.sql';

async function main() {
  process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', FILE), 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`${FILE} — ${stmts.length} statement(s) via RDS Data API\n`);
  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'insurance_applications'
       AND column_name IN ('coverage_selection', 'health_declarations', 'application_source')
     ORDER BY 1`,
  );
  console.log('\nNew application columns:', cols);

  const company = await query(
    `SELECT id, name, provider_code, status FROM insurance_companies
     WHERE lower(COALESCE(provider_code, '')) = 'hdfc_ergo'
        OR id = 'b1111111-1111-4111-8111-111111111101'
     LIMIT 3`,
  );
  console.log('HDFC company rows:', company);

  const plan = await query(
    `SELECT id, name, status FROM insurance_company_plans
     WHERE id = 'b2222222-2222-4222-8222-222222222201'
     LIMIT 1`,
  );
  console.log('Paws N Claws plan:', plan);
  console.log('\nMigration 1137 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

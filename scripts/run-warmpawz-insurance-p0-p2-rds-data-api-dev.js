#!/usr/bin/env node
/**
 * Apply Warmpawz Insurance P0–P2 migrations on dev via RDS Data API.
 * Files: 1127 core, 1128 rbac, 1129 onboarding form, 1130 plans.
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const FILES = [
  '1127_warmpawz_insurance_core.sql',
  '1128_warmpawz_insurance_rbac.sql',
  '1129_insurance_onboarding_form.sql',
  '1130_insurance_company_plans.sql',
];

async function main() {
  for (const file of FILES) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', file), 'utf8');
    const stmts = splitPostgresStatements(sql);
    console.log(`\n${file} — ${stmts.length} statement(s)`);
    for (let i = 0; i < stmts.length; i++) {
      console.log(`--- ${file} ${i + 1} / ${stmts.length} ---`);
      await executeSQL(stmts[i], false);
    }
  }

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'insurance_companies', 'insurance_company_plans', 'insurance_applications', 'insurance_commission_terms'
       )
     ORDER BY 1`
  );
  console.log('\nTables:', tables);

  const form = await query(
    `SELECT role_id, version FROM onboarding_forms WHERE role_id = 'insurance'`
  );
  console.log('Onboarding form:', form);
  console.log('\nInsurance P0–P2 migrations complete on dev.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

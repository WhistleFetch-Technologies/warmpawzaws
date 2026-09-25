/**
 * Apply migration 1117 on ENVIRONMENT (dev|prod) via RDS Data API, statement-by-statement (autocommit).
 * Avoids DO $$ blocks which fail on Data API inside multi-statement transactions.
 *
 * Usage: $env:ENVIRONMENT='dev'; node scripts/run-migration-1117-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

async function main() {
  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (env !== 'prod' && env !== 'dev') {
    console.error("Set ENVIRONMENT=prod (or dev) before running this script.");
    process.exit(1);
  }

  const migrationFile = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '1117_wappt_dual_appointment_fee_home.sql',
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql).filter((s) => {
    const t = s.trim().toUpperCase();
    // Data API often rejects anonymous DO blocks; apply CHECK separately below.
    return !t.startsWith('DO ');
  });

  console.log(`Environment: ${env}`);
  console.log(`Migration 1117 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const cons = await query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'warmpawz_appointments_vendor_catalog'::regclass
      AND conname = 'wappt_catalog_fee_home_nonneg_chk'
  `);
  if (!cons.length) {
    console.log('Adding CHECK constraint wappt_catalog_fee_home_nonneg_chk...');
    await executeSQL(
      `ALTER TABLE warmpawz_appointments_vendor_catalog
        ADD CONSTRAINT wappt_catalog_fee_home_nonneg_chk
        CHECK (appointment_fee_home >= 0)`,
      false,
    );
    console.log('Constraint added.\n');
  } else {
    console.log('CHECK constraint already present.\n');
  }

  const cols = await query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'warmpawz_appointments_vendor_catalog'
      AND column_name IN ('appointment_fee', 'appointment_fee_home')
    ORDER BY column_name
  `);
  console.log('columns:', JSON.stringify(cols, null, 2));

  const nulls = await query(`
    SELECT COUNT(*)::int AS null_home
    FROM warmpawz_appointments_vendor_catalog
    WHERE appointment_fee_home IS NULL
  `);
  console.log('null_home:', nulls);

  const sample = await query(`
    SELECT id::text, appointment_fee::float8 AS appointment_fee,
           appointment_fee_home::float8 AS appointment_fee_home
    FROM warmpawz_appointments_vendor_catalog
    LIMIT 3
  `);
  console.log('sample:', sample);
  console.log('Migration 1117 complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

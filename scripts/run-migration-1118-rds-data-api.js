/**
 * Apply migration 1118 on ENVIRONMENT (dev|prod) via RDS Data API.
 * Usage: $env:ENVIRONMENT='dev'; node scripts/run-migration-1118-rds-data-api.js
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
    '1118_wappt_seed_at_home_fees_by_category.sql',
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1118 — ${stmts.length} statement(s)\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const sample = await query(`
    SELECT
      c.appointment_fee::float8 AS centre,
      c.appointment_fee_home::float8 AS home,
      lower(coalesce(r.customer_service, r.name, '')) AS role_hint
    FROM warmpawz_appointments_vendor_catalog c
    JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    ORDER BY c.updated_at DESC
    LIMIT 10
  `);
  console.log('sample fees:', sample);
  console.log('Migration 1118 complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

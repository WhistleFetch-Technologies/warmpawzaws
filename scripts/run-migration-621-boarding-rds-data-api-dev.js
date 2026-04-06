#!/usr/bin/env node
/**
 * Run migration 621 (bookings check_in_date, check_out_date, check_out_time) on dev via RDS Data API.
 * No direct TCP to RDS required (works when HttpEndpointEnabled on the cluster).
 *
 * Usage:
 *   node scripts/run-migration-621-boarding-rds-data-api-dev.js
 */

const fs = require('fs');
const path = require('path');
const {
  getClusterInfo,
  executeSQL,
  splitPostgresStatements,
  parseRecords,
} = require('./rds-data-api-utils-dev');

async function main() {
  console.log('Migration 621: bookings boarding stay window (dev, RDS Data API)\n');

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '621_bookings_boarding_stay_window.sql'
  );
  if (!fs.existsSync(migrationPath)) {
    console.error('Missing file:', migrationPath);
    process.exit(1);
  }

  await getClusterInfo();
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = splitPostgresStatements(sql).map((s) => s.trim()).filter(Boolean);

  console.log(`Executing ${statements.length} statement(s)...\n`);
  for (let i = 0; i < statements.length; i++) {
    console.log(`[${i + 1}/${statements.length}]`);
    await executeSQL(statements[i], false);
  }

  const verifySql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name IN ('check_in_date', 'check_out_date', 'check_out_time')
    ORDER BY column_name
  `;
  const verifyResult = await executeSQL(verifySql, true);
  const rows = parseRecords(verifyResult);
  const names = rows.map((r) => Object.values(r)[0]).filter(Boolean);
  if (names.length < 3) {
    console.error('Verification failed: expected 3 columns, got:', names);
    process.exit(1);
  }
  console.log('\nOK — columns present:', names.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

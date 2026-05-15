#!/usr/bin/env node
/**
 * Run migration 605 (vendors.availability_configured + services_configured) on dev via RDS Data API.
 * No VPC / direct pg connection required.
 *
 * Usage:
 *   node scripts/run-migration-605-rds-data-api-dev.js
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
  console.log('Migration 605: availability_configured (dev, RDS Data API)\n');

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '605_add_availability_configured_column.sql'
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
    SELECT COUNT(*) FILTER (WHERE column_name = 'availability_configured') AS availability_col,
           COUNT(*) FILTER (WHERE column_name = 'services_configured') AS services_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors'
      AND column_name IN ('availability_configured', 'services_configured')
  `;
  const verifyResult = await executeSQL(verifySql, true);
  const rows = parseRecords(verifyResult);
  const row = rows[0] || {};
  const vals = Object.values(row).map((v) => Number(v));
  const av = vals[0] ?? 0;
  const sv = vals[1] ?? 0;
  if (av < 1) {
    console.error('Verification failed: public.vendors.availability_configured missing');
    process.exit(1);
  }
  console.log('\nOK — availability_configured:', av >= 1, 'services_configured:', sv >= 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

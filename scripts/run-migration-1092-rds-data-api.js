#!/usr/bin/env node
/**
 * Run migration 1092 on dev/prod via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1092-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1092_wappt_default_1h_cancellation_policy.sql',
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1092 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`,
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 120).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const tiers = await query(`
    SELECT name, cancelled_by, hours_before_service, hours_operator, hours_threshold, refund_percentage
    FROM vendor_refund_tiers
    WHERE commerce_mode = 'warmpawz_appointments'
      AND policy_scope = 'platform'
    ORDER BY cancelled_by, tier_level, name
  `);
  console.log('\nVerified WAPPT platform tiers:');
  console.log(JSON.stringify(tiers, null, 2));
  console.log('\nMigration 1092 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

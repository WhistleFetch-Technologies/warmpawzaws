#!/usr/bin/env node
/**
 * Run Discount Engine V2 migrations (1067–1071) via RDS Data API.
 * Renumbered from 1058/1061–1064 to avoid conflicts with develop migrations.
 * Usage: ENVIRONMENT=prod node scripts/run-discount-engine-migrations-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL } = require('./rds-data-api-utils-dev');

const DISCOUNT_ENGINE_MIGRATIONS = [
  '1067_vendor_earnings_settlement_metadata.sql',
  '1068_discount_policy_center_v2.sql',
  '1069_coupons_service_targeting.sql',
  '1070_promotions_coupons_discount_domain.sql',
  '1071_commercial_campaigns_discount_domain_budget.sql',
];

async function runMigrationFile(filename) {
  const filePath = path.join(__dirname, '..', 'db', 'migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`\n=== ${filename} (${stmts.length} statements) ===`);
  for (let i = 0; i < stmts.length; i++) {
    console.log(`  [${i + 1}/${stmts.length}] ${stmts[i].replace(/\s+/g, ' ').slice(0, 72)}...`);
    await executeSQL(stmts[i], false);
  }
}

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  console.log(`Discount Engine migrations 1067–1071 — ENVIRONMENT=${env}`);
  for (const file of DISCOUNT_ENGINE_MIGRATIONS) {
    await runMigrationFile(file);
  }
  console.log('\nAll discount engine migrations complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

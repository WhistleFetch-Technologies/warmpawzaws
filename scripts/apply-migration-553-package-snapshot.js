#!/usr/bin/env node
/**
 * Apply migration 553 (package_purchases.package_snapshot + index) to Dev and Prod RDS.
 * Uses RDS Data API (run-migration-via-rds-data-api.js) so it works without VPC access.
 *
 * Usage:
 *   node scripts/apply-migration-553-package-snapshot.js
 *   node scripts/apply-migration-553-package-snapshot.js --dev-only
 *   node scripts/apply-migration-553-package-snapshot.js --prod-only
 *
 * Requires: AWS CLI configured; RDS Data API enabled on clusters warmpawz-dev-cluster and warmpawz-prod-cluster.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const MIGRATION_FILE = '553_package_purchases_snapshot_and_included.sql';
const scriptDir = __dirname;
const runMigrationScript = path.join(scriptDir, 'run-migration-via-rds-data-api.js');

function runForEnv(env) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Applying migration 553 to ${env.toUpperCase()} environment`);
  console.log('='.repeat(60));
  const result = spawnSync(
    process.execPath,
    [runMigrationScript, MIGRATION_FILE],
    {
      env: { ...process.env, ENVIRONMENT: env },
      stdio: 'inherit',
      cwd: path.join(scriptDir, '..'),
    }
  );
  if (result.status !== 0) {
    console.error(`\n❌ Migration failed for ${env}. Exit code: ${result.status}`);
    process.exit(result.status);
  }
  console.log(`\n✅ Migration 553 applied successfully to ${env}.`);
}

const devOnly = process.argv.includes('--dev-only');
const prodOnly = process.argv.includes('--prod-only');

if (prodOnly) {
  runForEnv('prod');
} else if (devOnly) {
  runForEnv('dev');
} else {
  runForEnv('dev');
  runForEnv('prod');
}

console.log('\n🎉 Migration 553 complete for requested environment(s).\n');

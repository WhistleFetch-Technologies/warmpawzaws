/**
 * Run migration 1105 via RDS Data API (dev|prod).
 * Usage (PowerShell): $env:ENVIRONMENT='dev'; node scripts/run-migration-1105-rds-data-api.js
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
    '1105_pause_customer_loyalty_and_zero_points.sql'
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1105 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const enabled = await query(`
    SELECT COUNT(*)::int AS enabled_count
    FROM action_sources
    WHERE enabled = true
  `);
  const points = await query(`
    SELECT
      COUNT(*)::int AS loyalty_rows,
      COALESCE(SUM(total_points), 0) AS sum_points,
      COALESCE(SUM(lifetime_points_earned), 0) AS sum_earned,
      COALESCE(SUM(lifetime_points_redeemed), 0) AS sum_redeemed
    FROM customer_loyalty_points
  `);
  console.log('VERIFY_ENABLED_SOURCES', JSON.stringify(enabled, null, 2));
  console.log('VERIFY_LOYALTY_POINTS', JSON.stringify(points, null, 2));

  const enabledCount = Number(enabled?.[0]?.enabled_count ?? enabled?.[0]?.enabledcount ?? 0);
  if (enabledCount > 0) {
    throw new Error(`action_sources still enabled: ${enabledCount}`);
  }
  console.log('Migration 1105 complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Run migration 1087 on the environment in ENVIRONMENT (prod|dev) via RDS Data API.
 * Usage (PowerShell): $env:ENVIRONMENT='dev'; node scripts/run-migration-1087-rds-data-api.js
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
    '1087_pet_profile_loyalty_on_complete.sql'
  );
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1087 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const sources = await query(`
    SELECT method, route_pattern, action_name, success_predicate, enabled
    FROM action_sources
    WHERE action_name = 'complete_pet_profile'
    ORDER BY method, route_pattern
  `);
  console.log('VERIFY_SOURCES', JSON.stringify(sources, null, 2));

  const wrongPredicate = (sources || []).filter(
    (row) => row.success_predicate !== '$.success && $.petProfileCompleted == true'
  );
  if (wrongPredicate.length > 0) {
    throw new Error('complete_pet_profile sources still missing petProfileCompleted predicate');
  }

  const putPets = (sources || []).some(
    (row) => row.method === 'PUT' && row.route_pattern === '/pets/:petId' && row.enabled
  );
  const putPhone = (sources || []).some(
    (row) =>
      row.method === 'PUT' &&
      row.route_pattern === '/customer/:phone/pets/:petId' &&
      row.enabled
  );
  if (!putPets || !putPhone) {
    throw new Error('Missing PUT complete_pet_profile action_sources after 1087');
  }

  console.log('Migration 1087 complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

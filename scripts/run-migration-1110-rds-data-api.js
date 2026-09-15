/**
 * Run migration 1110 via RDS Data API (dev|prod), statement-by-statement.
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/run-migration-1110-rds-data-api.js
 *   $env:ENVIRONMENT='prod'; node scripts/run-migration-1110-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const {
  splitPostgresStatements,
  executeSQL,
  query,
  ENVIRONMENT,
} = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1110_vet_comprehensive_catalogue_descriptions.sql',
);

function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function parseUpdates(sql) {
  const updates = [];
  const re =
    /--\s+(\d+\.\d+)\s+([^\n]+)\n-- Maps to: ([^\n]+)\nUPDATE[\s\S]*?SET description = '((?:[^']|'')*)'/g;
  let m;
  while ((m = re.exec(sql))) {
    updates.push({
      code: m[1],
      name: m[2].trim(),
      names: m[3].split('|').map((s) => s.trim()),
      description: m[4].replace(/''/g, "'"),
    });
  }
  return updates;
}

async function verify(updates) {
  const names = [...new Set(updates.flatMap((u) => u.names))];
  const rows = await query(`
    SELECT TRIM(display_name) AS display_name,
           description,
           status,
           category_name
    FROM service_catalog
    WHERE TRIM(display_name) IN (${names.map(sqlString).join(', ')})
  `);
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.display_name)) byName.set(r.display_name, []);
    byName.get(r.display_name).push(r);
  }

  let matched = 0;
  let differed = 0;
  let missing = 0;
  for (const u of updates) {
    for (const n of u.names) {
      const hits = byName.get(n) || [];
      if (!hits.length) {
        missing += 1;
        console.log(`  MISSING\t${u.code}\t${n}`);
        continue;
      }
      for (const row of hits) {
        if (row.description === u.description) matched += 1;
        else {
          differed += 1;
          console.log(`  DIFF\t${u.code}\t${n}\t${row.category_name}\t${row.status}`);
        }
      }
    }
  }
  console.log(`VERIFY matched=${matched} differed=${differed} missing_names=${missing} row_hits=${rows.length}`);
  return { matched, differed, missing };
}

async function main() {
  const env = (ENVIRONMENT || '').toLowerCase();
  if (env !== 'prod' && env !== 'dev') {
    console.error("Set ENVIRONMENT=prod (or dev) before running this script.");
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  const updates = parseUpdates(sql);
  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1110 — ${stmts.length} statement(s), ${updates.length} mapped services\n`);

  let recordsUpdated = 0;
  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 140).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 140 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    const n = result?.numberOfRecordsUpdated ?? 0;
    recordsUpdated += Number(n) || 0;
    console.log(`OK (recordsUpdated=${n})\n`);
  }

  console.log(`TOTAL_RECORDS_UPDATED=${recordsUpdated}`);
  const { differed } = await verify(updates);
  if (differed > 0) {
    throw new Error(`Verification failed: ${differed} row(s) still differ`);
  }
  console.log('Migration 1110 complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

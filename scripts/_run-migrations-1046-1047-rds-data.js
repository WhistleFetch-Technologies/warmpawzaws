#!/usr/bin/env node
/**
 * Run migrations 1046 + 1047 on dev via RDS Data API (ExecuteStatement per statement).
 * Usage: ENVIRONMENT=dev node scripts/_run-migrations-1046-1047-rds-data.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'db', 'migrations', '1046_search_trgm_indexes.sql'),
  path.join(ROOT, 'db', 'migrations', '1047_search_index_services_products.sql'),
];

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const stmts = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);
  console.log(`\n=== ${path.basename(filePath)} (${stmts.length} statement(s)) ===\n`);
  let ok = 0;
  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 100);
    console.log(`--- [${i + 1}/${stmts.length}] ${preview}${stmts[i].length > 100 ? '…' : ''}`);
    try {
      await executeSQL(stmts[i], false);
      ok++;
    } catch (err) {
      const msg = err.message || String(err);
      if (/already exists|duplicate key|does not exist, skipping/i.test(msg)) {
        console.log(`   Non-fatal: ${msg.slice(0, 200)}`);
        ok++;
      } else {
        throw err;
      }
    }
  }
  console.log(`Done ${path.basename(filePath)}: ${ok}/${stmts.length}\n`);
}

async function verify() {
  console.log('=== Verification ===\n');
  const indexes = await query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_vendors_business_name_trgm',
        'idx_vendor_services_service_name_trgm',
        'idx_products_name_trgm',
        'idx_vendors_discoverable'
      )
    ORDER BY indexname
  `);
  console.log('Trgm/partial indexes:', indexes.map((r) => r.indexname || r[0]));

  const counts = await query(`
    SELECT entity_type, COUNT(*)::bigint AS cnt
    FROM search_index
    WHERE entity_type IN ('vendor', 'service', 'product', 'staff')
    GROUP BY entity_type
    ORDER BY entity_type
  `);
  console.log('search_index row counts:', counts);
}

async function main() {
  for (const file of FILES) {
    if (!fs.existsSync(file)) throw new Error(`Missing: ${file}`);
    await runFile(file);
  }
  await verify();
  console.log('All migrations applied via RDS Data API.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

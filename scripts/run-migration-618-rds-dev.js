#!/usr/bin/env node
/**
 * Migration 618 (pet insurance RDS alignment) — DEV cluster only.
 * Uses RDS Data API via aws CLI; splits SQL with dollar-quote awareness (DO $$ blocks).
 *
 * Usage:
 *   node scripts/run-migration-618-rds-dev.js
 */

process.env.ENVIRONMENT = 'dev';

const fs = require('fs');
const path = require('path');
const { getClusterInfo, executeSQL, splitPostgresStatements, CLUSTER_IDENTIFIER } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '618_pet_insurance_lambda_rds_alignment.sql');

async function main() {
  console.log('============================================================================');
  console.log('MIGRATION 618 — Pet insurance Lambda / RDS alignment (DEV ONLY)');
  console.log(`Cluster: ${CLUSTER_IDENTIFIER}`);
  console.log('============================================================================\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const statements = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);

  console.log(`Parsed ${statements.length} SQL statement(s).\n`);

  await getClusterInfo();

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
    console.log(`\n--- [${i + 1}/${statements.length}] ${preview}${stmt.length > 80 ? '…' : ''}`);
    try {
      await executeSQL(stmt, false);
      ok++;
    } catch (e) {
      const msg = e.message || String(e);
      if (/already exists|duplicate key/i.test(msg)) {
        console.log('   ⚠️  Non-fatal (already applied):', msg.slice(0, 200));
        ok++;
      } else {
        console.error('   ❌', msg);
        failed++;
        throw e;
      }
    }
  }

  console.log('\n============================================================================');
  console.log(`Done. ${ok} statement(s) OK${failed ? `, ${failed} failed` : ''}.`);
  console.log('============================================================================\n');
}

main().catch(() => process.exit(1));

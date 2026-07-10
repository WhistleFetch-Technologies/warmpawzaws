#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '1068_discount_policy_center_v2.sql');

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1068 — ${stmts.length} statement(s) on ${env}\n`);

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    await executeSQL(stmts[i], false);
  }

  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'discount_policy%'
    ORDER BY 1
  `);
  console.log('\nVerified tables:', tables);
  console.log('\nMigration 1068 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

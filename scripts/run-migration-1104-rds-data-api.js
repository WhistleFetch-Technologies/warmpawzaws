#!/usr/bin/env node
/**
 * Run migration 1104 on dev/prod via RDS Data API (ExecuteStatement, statement-by-statement).
 * Usage: ENVIRONMENT=dev node scripts/run-migration-1104-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1104_events_tickets_payments_rbac.sql',
);

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(
    `Migration 1104 — ${stmts.length} statement(s) on ${process.env.ENVIRONMENT || 'dev'} via RDS Data API\n`,
  );

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 140).replace(/\n/g, ' ') + '...');
    await executeSQL(stmts[i], false);
    console.log('OK');
  }

  const tickets = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_registration_tickets'
    ORDER BY ordinal_position
  `);
  console.log('\nVerified event_registration_tickets columns:');
  console.log(JSON.stringify(tickets, null, 2));

  const paymentCol = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'event_registration_id'
  `);
  console.log('\nVerified payments.event_registration_id:');
  console.log(JSON.stringify(paymentCol, null, 2));

  const grants = await query(`
    SELECT COUNT(*)::int AS events_capability_roles
    FROM role_permissions
    WHERE permission_name = 'events'
  `);
  console.log('\nVerified events capability grants:');
  console.log(JSON.stringify(grants, null, 2));

  console.log('\nMigration 1104 complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

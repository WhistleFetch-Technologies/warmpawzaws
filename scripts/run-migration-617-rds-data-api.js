#!/usr/bin/env node
/**
 * Migration 617 — support_tickets.attachments (RDS Data API).
 *
 * Why not run-migration-rds-node.js? That path uses direct Postgres (pg) to the
 * cluster endpoint; it still requires AWS CLI for describe-db-clusters + secrets.
 * This script uses ExecuteStatement via @aws-sdk/client-rds-data (same as 618).
 *
 * Prerequisites:
 *   - AWS credentials (default chain: env vars, ~/.aws/credentials, IAM role)
 *   - Cluster has RDS Data API enabled (HttpEndpointEnabled)
 *
 * Usage (PowerShell):
 *   cd <repo-root>/scripts && npm install
 *   $env:ENVIRONMENT = "dev"    # or "prod" for warmpawz-prod-cluster
 *   $env:AWS_REGION = "ap-south-1"
 *   npm run migrate:617
 *   # or: node run-migration-617-rds-data-api.js
 *
 * Uses @aws-sdk (DescribeDBClusters, DescribeSecret, ExecuteStatement) — same as `aws rds-data execute-statement`.
 * Pure AWS CLI (no Node): run scripts/run-migration-617-aws-cli.ps1 from PowerShell with `aws` on PATH.
 */

const fs = require('fs');
const path = require('path');
const {
  getClusterInfo,
  executeSQL,
  splitPostgresStatements,
  query,
  CLUSTER_IDENTIFIER,
  ENVIRONMENT,
} = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '617_support_tickets_attachments_column.sql');

async function main() {
  console.log('============================================================================');
  console.log('MIGRATION 617 — support_tickets.attachments (RDS Data API)');
  console.log(`Environment: ${ENVIRONMENT}  Cluster: ${CLUSTER_IDENTIFIER}`);
  console.log('Scope: only adds public.support_tickets.attachments (IF NOT EXISTS). No other tables.');
  console.log('============================================================================\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const statements = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);

  console.log(`Parsed ${statements.length} SQL statement(s).\n`);

  await getClusterInfo();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
    console.log(`\n--- [${i + 1}/${statements.length}] ${preview}${stmt.length > 80 ? '…' : ''}`);
    try {
      await executeSQL(stmt, false);
    } catch (e) {
      const msg = e.message || String(e);
      if (/already exists|duplicate column/i.test(msg)) {
        console.log('   ⚠️  Non-fatal (already applied):', msg.slice(0, 200));
      } else {
        console.error('   ❌', msg);
        throw e;
      }
    }
  }

  console.log('\n🔍 Verifying column support_tickets.attachments ...');
  const rows = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'attachments'
  `);
  if (!rows.length) {
    console.error('❌ Verification failed: attachments column not found.');
    process.exit(1);
  }
  console.log('   ✅', rows[0]);

  console.log('\n============================================================================');
  console.log('Migration 617 complete.');
  console.log('============================================================================\n');
}

main().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  if (/credential|CredentialProvider|Could not load credentials/i.test(msg)) {
    console.error('\n--- AWS credentials missing ---');
    console.error('Do one of the following, then run: npm run migrate:617');
    console.error('  1. Copy scripts/env.migration.example → scripts/.env.local and set keys or AWS_PROFILE');
    console.error('  2. Run: aws configure   (creates %USERPROFILE%\\.aws\\credentials)');
    console.error('  3. PowerShell: $env:AWS_ACCESS_KEY_ID="..."; $env:AWS_SECRET_ACCESS_KEY="..."\n');
  }
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Migration 542 — vendor_refund_tiers.policy_extensions (jsonb)
 * DEV RDS only. Runs each statement via: aws rds-data execute-statement --cli-input-json file://...
 *
 * Reference metadata (set when you run, for your logs / tickets):
 *   - MIGRATION_RUN_DATE  — defaults to today's UTC date (YYYY-MM-DD); override if needed
 *   - TARGET_ENV          — defaults to "dev"
 *
 * Usage:
 *   node scripts/run-migration-542-rds-data-api-dev-cli.js
 *
 * Optional overrides:
 *   MIGRATION_RUN_DATE=2026-04-15 TARGET_ENV=dev AWS_REGION=ap-south-1 \
 *   RDS_CLUSTER_IDENTIFIER=warmpawz-dev-cluster \
 *   RDS_SECRET_NAME=warmpawz-dev-rds-master-20260106164510791100000002 \
 *   RDS_DATABASE=warmpawz \
 *   node scripts/run-migration-542-rds-data-api-dev-cli.js
 *
 * Requires: AWS CLI v2, credentials for dev account, RDS Data API enabled on dev cluster.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { splitPostgresStatements } = require('./rds-data-api-utils-dev');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER =
  process.env.RDS_CLUSTER_IDENTIFIER || process.env.DB_CLUSTER_IDENTIFIER || 'warmpawz-dev-cluster';
const SECRET_NAME =
  process.env.RDS_SECRET_NAME ||
  process.env.RDS_MASTER_SECRET_NAME ||
  'warmpawz-dev-rds-master-20260106164510791100000002';
const DATABASE_NAME = process.env.RDS_DATABASE || process.env.DB_NAME || 'warmpawz';

/** Calendar date for your reference (override with MIGRATION_RUN_DATE=YYYY-MM-DD). */
const MIGRATION_RUN_DATE =
  process.env.MIGRATION_RUN_DATE || new Date().toISOString().slice(0, 10);
/** Environment label for logs (default dev). */
const TARGET_ENV = process.env.TARGET_ENV || process.env.ENVIRONMENT || 'dev';

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '542_vendor_refund_tiers_policy_extensions.sql'
);

function assertDevOnly(clusterArn) {
  if (!clusterArn || typeof clusterArn !== 'string') {
    throw new Error('Missing cluster ARN');
  }
  const lower = clusterArn.toLowerCase();
  if (lower.includes('prod')) {
    throw new Error('Refusing to run: cluster ARN looks like production.');
  }
  if (!lower.includes('dev')) {
    throw new Error('Refusing to run: cluster ARN must be dev (expected "dev" in ARN).');
  }
}

function getClusterInfoCli() {
  console.log('Resolving cluster + secret (AWS CLI)...\n');

  const clusterInfoJson = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_IDENTIFIER} --region ${REGION} --output json`,
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      maxBuffer: 16 * 1024 * 1024,
    }
  );

  const clusterInfo = JSON.parse(clusterInfoJson);
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${CLUSTER_IDENTIFIER}`);
  }

  const cluster = clusterInfo.DBClusters[0];
  const clusterArn = cluster.DBClusterArn;
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API is not enabled on ${CLUSTER_IDENTIFIER}.`);
  }

  const secretInfoJson = execSync(
    `aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      maxBuffer: 4 * 1024 * 1024,
    }
  );

  const secretInfo = JSON.parse(secretInfoJson);
  const secretArn = secretInfo.ARN;

  console.log(`   Cluster ARN: ${clusterArn}`);
  console.log(`   Secret ARN:  ${secretArn}\n`);

  return { clusterArn, secretArn };
}

function executeStatementCli(clusterArn, secretArn, sql) {
  const inputFile = path.join(__dirname, `_tmp_rds_data_542_input_${Date.now()}.json`);
  const payload = {
    resourceArn: clusterArn,
    secretArn,
    database: DATABASE_NAME,
    sql,
  };
  fs.writeFileSync(inputFile, JSON.stringify(payload), 'utf8');
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');

  try {
    execSync(
      `aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
        timeout: 300000,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function main() {
  console.log('============================================================================');
  console.log('MIGRATION 542 — vendor_refund_tiers.policy_extensions (RDS Data API, AWS CLI)');
  console.log('============================================================================');
  console.log(`MIGRATION_RUN_DATE (reference): ${MIGRATION_RUN_DATE}`);
  console.log(`TARGET_ENV (reference):       ${TARGET_ENV}`);
  console.log(`AWS_REGION:                   ${REGION}`);
  console.log(`Cluster identifier:           ${CLUSTER_IDENTIFIER}`);
  console.log(`Database:                     ${DATABASE_NAME}`);
  console.log(`Migration file:               ${MIGRATION_FILE}`);
  console.log('============================================================================\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const { clusterArn, secretArn } = getClusterInfoCli();
  assertDevOnly(clusterArn);

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const statements = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);

  console.log(`Parsed ${statements.length} SQL statement(s). Executing via AWS CLI...\n`);

  let ok = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 120).replace(/\s+/g, ' ');
    console.log(`--- [${i + 1}/${statements.length}] ${preview}${stmt.length > 120 ? '…' : ''}`);
    try {
      executeStatementCli(clusterArn, secretArn, stmt);
      console.log('   OK\n');
      ok++;
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : '';
      const msg = (e.message || '') + stderr;
      if (/already exists|duplicate column/i.test(msg)) {
        console.log('   Non-fatal (already applied):', msg.slice(0, 250));
        ok++;
      } else {
        console.error('   FAILED:', msg.slice(0, 500));
        process.exit(1);
      }
    }
  }

  console.log('============================================================================');
  console.log(`Done. ${ok}/${statements.length} statement(s) executed.`);
  console.log(`Reference: MIGRATION_RUN_DATE=${MIGRATION_RUN_DATE} TARGET_ENV=${TARGET_ENV}`);
  console.log('============================================================================');
}

main();

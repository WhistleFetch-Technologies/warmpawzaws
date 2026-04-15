#!/usr/bin/env node
/**
 * Migration 542 — vendor_refund_tiers.policy_extensions (jsonb)
 * PRODUCTION RDS. Each statement: aws rds-data execute-statement --cli-input-json file://...
 *
 * Logs:
 *   - MIGRATION_RUN_DATETIME — ISO 8601 in UTC (date + time), override with MIGRATION_RUN_DATETIME=...
 *   - Appends one line to scripts/migration-542-prod-runs.log (gitignored recommended)
 *
 * Safety: set CONFIRM_PROD_MIGRATION_542=yes (exactly) or the script exits.
 *
 * Usage:
 *   CONFIRM_PROD_MIGRATION_542=yes node scripts/run-migration-542-rds-data-api-prod-cli.js
 *
 * Optional overrides:
 *   MIGRATION_RUN_DATETIME=2026-04-15T12:00:00.000Z \
 *   AWS_REGION=ap-south-1 \
 *   RDS_CLUSTER_IDENTIFIER=warmpawz-prod-cluster \
 *   RDS_SECRET_NAME=warmpawz-prod-rds-master-20260207201049162400000001 \
 *   RDS_DATABASE=warmpawz \
 *   CONFIRM_PROD_MIGRATION_542=yes \
 *   node scripts/run-migration-542-rds-data-api-prod-cli.js
 *
 * Requires: AWS CLI v2, prod credentials, RDS Data API enabled on prod cluster.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { splitPostgresStatements } = require('./rds-data-api-utils-dev');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER =
  process.env.RDS_CLUSTER_IDENTIFIER ||
  process.env.DB_CLUSTER_IDENTIFIER ||
  'warmpawz-prod-cluster';
const SECRET_NAME =
  process.env.RDS_SECRET_NAME ||
  process.env.RDS_MASTER_SECRET_NAME ||
  'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE_NAME = process.env.RDS_DATABASE || process.env.DB_NAME || 'warmpawz';

/** Full date+time for audit (override with MIGRATION_RUN_DATETIME=ISO string). */
const MIGRATION_RUN_DATETIME =
  process.env.MIGRATION_RUN_DATETIME || new Date().toISOString();
const TARGET_ENV = process.env.TARGET_ENV || process.env.ENVIRONMENT || 'prod';

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '542_vendor_refund_tiers_policy_extensions.sql'
);

const RUN_LOG = path.join(__dirname, 'migration-542-prod-runs.log');

function assertProdOnly(clusterArn) {
  if (!clusterArn || typeof clusterArn !== 'string') {
    throw new Error('Missing cluster ARN');
  }
  const lower = clusterArn.toLowerCase();
  if (lower.includes('dev') && !lower.includes('prod')) {
    throw new Error('Refusing to run: cluster ARN looks like dev, not production.');
  }
  if (!lower.includes('prod')) {
    throw new Error('Refusing to run: cluster ARN must be production (expected "prod" in ARN).');
  }
}

function requireProdConfirmation() {
  if (process.env.CONFIRM_PROD_MIGRATION_542 !== 'yes') {
    console.error(
      'Refusing to run on PROD: set CONFIRM_PROD_MIGRATION_542=yes after reviewing the SQL in db/migrations/542_vendor_refund_tiers_policy_extensions.sql'
    );
    process.exit(1);
  }
}

function appendRunLog(line) {
  try {
    fs.appendFileSync(RUN_LOG, line + '\n', 'utf8');
  } catch (e) {
    console.warn('Could not append run log:', RUN_LOG, e.message);
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
  const inputFile = path.join(__dirname, `_tmp_rds_data_542_prod_input_${Date.now()}.json`);
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
  requireProdConfirmation();

  console.log('============================================================================');
  console.log('MIGRATION 542 — vendor_refund_tiers.policy_extensions (PROD, RDS Data API)');
  console.log('============================================================================');
  console.log(`MIGRATION_RUN_DATETIME (UTC): ${MIGRATION_RUN_DATETIME}`);
  console.log(`TARGET_ENV:                   ${TARGET_ENV}`);
  console.log(`AWS_REGION:                   ${REGION}`);
  console.log(`Cluster identifier:           ${CLUSTER_IDENTIFIER}`);
  console.log(`Database:                     ${DATABASE_NAME}`);
  console.log(`Migration file:               ${MIGRATION_FILE}`);
  console.log(`Run log file:                 ${RUN_LOG}`);
  console.log('============================================================================\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const { clusterArn, secretArn } = getClusterInfoCli();
  assertProdOnly(clusterArn);

  appendRunLog(
    `[START] ${MIGRATION_RUN_DATETIME} migration=542 env=${TARGET_ENV} cluster=${CLUSTER_IDENTIFIER} db=${DATABASE_NAME}`
  );

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
        appendRunLog(`[FAIL] ${MIGRATION_RUN_DATETIME} ${msg.slice(0, 300)}`);
        console.error('   FAILED:', msg.slice(0, 500));
        process.exit(1);
      }
    }
  }

  appendRunLog(
    `[DONE] ${MIGRATION_RUN_DATETIME} migration=542 statements_ok=${ok}/${statements.length}`
  );

  console.log('============================================================================');
  console.log(`Done. ${ok}/${statements.length} statement(s) executed.`);
  console.log(`MIGRATION_RUN_DATETIME=${MIGRATION_RUN_DATETIME} TARGET_ENV=${TARGET_ENV}`);
  console.log('============================================================================');
}

main();

#!/usr/bin/env node
/**
 * Migration 722 (service_categories has_problem_grid + vendor_roles) — PRODUCTION.
 * Runs each statement via: aws rds-data execute-statement --cli-input-json file://...
 * Uses dollar-quote–aware splitting for DO $$ blocks.
 *
 * SAFETY: Set I_CONFIRM_PROD_MIGRATION_722=YES or the script exits without running.
 *
 * Usage (PowerShell):
 *   $env:I_CONFIRM_PROD_MIGRATION_722='YES'; node scripts/run-migration-722-rds-data-api-prod-cli.js
 *
 * Usage (bash):
 *   I_CONFIRM_PROD_MIGRATION_722=YES node scripts/run-migration-722-rds-data-api-prod-cli.js
 *
 * Requires: AWS CLI v2, prod account credentials, RDS Data API enabled on prod cluster.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE_NAME = 'warmpawz';

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '722_service_categories_problem_grid_vendor_roles.sql'
);

/** Same algorithm as run-migration-711-rds-data-api-prod-cli.js */
function stripSqlComments(sql) {
  let out = '';
  let i = 0;
  let state = 'code';
  let dollarTag = '';

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (state === 'code') {
      if (c === '-' && next === '-') {
        i += 2;
        while (i < sql.length && sql[i] !== '\n') i++;
        if (i < sql.length) {
          out += '\n';
          i++;
        }
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        out += '\n';
        continue;
      }
      if (c === "'") {
        state = 'squote';
        out += c;
        i++;
        continue;
      }
      if (c === '$') {
        const rest = sql.slice(i);
        const m = rest.match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          dollarTag = m[1];
          state = 'dollar';
          out += m[0];
          i += m[0].length;
          continue;
        }
      }
      out += c;
      i++;
      continue;
    }

    if (state === 'squote') {
      out += c;
      if (c === "'" && next === "'") {
        out += next;
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'code';
      }
      i++;
      continue;
    }

    if (state === 'dollar') {
      const close = '$' + dollarTag + '$';
      if (sql.slice(i, i + close.length) === close) {
        out += close;
        i += close.length;
        state = 'code';
        continue;
      }
      out += c;
      i++;
      continue;
    }
  }
  return out;
}

function splitPostgresStatements(sql) {
  const clean = stripSqlComments(sql);
  const statements = [];
  let buf = '';
  let i = 0;
  let state = 'code';
  let dollarTag = '';

  while (i < clean.length) {
    const c = clean[i];
    const next = clean[i + 1];

    if (state === 'code') {
      if (c === "'") {
        state = 'squote';
        buf += c;
        i++;
        continue;
      }
      if (c === '$') {
        const rest = clean.slice(i);
        const m = rest.match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          dollarTag = m[1];
          state = 'dollar';
          buf += m[0];
          i += m[0].length;
          continue;
        }
      }
      if (c === ';') {
        const t = buf.trim();
        if (t.length > 0) statements.push(t);
        buf = '';
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (state === 'squote') {
      buf += c;
      if (c === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'code';
      }
      i++;
      continue;
    }

    if (state === 'dollar') {
      const close = '$' + dollarTag + '$';
      if (clean.slice(i, i + close.length) === close) {
        buf += close;
        i += close.length;
        state = 'code';
        continue;
      }
      buf += c;
      i++;
      continue;
    }
  }

  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

function assertProdOnly(clusterArn) {
  if (!clusterArn || typeof clusterArn !== 'string') {
    throw new Error('Missing cluster ARN');
  }
  const lower = clusterArn.toLowerCase();
  if (!lower.includes('prod') || !lower.includes('warmpawz-prod-cluster')) {
    throw new Error('Refusing to run: cluster ARN must be production warmpawz-prod-cluster.');
  }
  if (lower.includes('dev') && !lower.includes('prod')) {
    throw new Error('Refusing to run: cluster ARN looks like dev, not prod.');
  }
}

function getClusterInfoCli() {
  console.log('Resolving prod cluster + secret (AWS CLI)...\n');

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
  const inputFile = path.join(__dirname, '_tmp_rds_data_722_prod_input.json');
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
  if (process.env.I_CONFIRM_PROD_MIGRATION_722 !== 'YES') {
    console.error(
      'Refusing to run on PROD. Set environment variable exactly:\n' +
        '  I_CONFIRM_PROD_MIGRATION_722=YES\n' +
        'Then re-run this script.'
    );
    process.exit(1);
  }

  console.log('============================================================================');
  console.log('MIGRATION 722 — service_categories catalog columns (PRODUCTION, RDS Data API CLI)');
  console.log(`Cluster identifier: ${CLUSTER_IDENTIFIER}`);
  console.log(`Region: ${REGION}`);
  console.log('============================================================================\n');

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const { clusterArn, secretArn } = getClusterInfoCli();
  assertProdOnly(clusterArn);

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const statements = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);

  console.log(`Parsed ${statements.length} SQL statement(s). Executing via AWS CLI...\n`);

  let ok = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 100).replace(/\s+/g, ' ');
    console.log(`--- [${i + 1}/${statements.length}] ${preview}${stmt.length > 100 ? '…' : ''}`);
    try {
      executeStatementCli(clusterArn, secretArn, stmt);
      console.log('   OK\n');
      ok++;
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : '';
      const msg = (e.message || '') + stderr;
      if (/already exists|duplicate key|column .* already exists/i.test(msg)) {
        console.log('   Non-fatal (already applied):', msg.slice(0, 250));
        ok++;
      } else {
        console.error('   FAILED:', msg.slice(0, 500));
        process.exit(1);
      }
    }
  }

  console.log('============================================================================');
  console.log(`Done. ${ok}/${statements.length} statement(s) executed on PRODUCTION.`);
  console.log('============================================================================');
}

main();

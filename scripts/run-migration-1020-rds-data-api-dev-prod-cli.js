#!/usr/bin/env node
/**
 * Migration 1020 — notification delivery state machine + delivery log (DEV and/or PROD).
 * Runs db/migrations/1020_notification_delivery_state_machine.sql via:
 *   aws rds-data execute-statement --cli-input-json file://...
 *
 * Uses dollar-quote–aware splitting (same as run-migration-729-rds-data-api-dev-prod-cli.js).
 *
 * Usage (PowerShell, dev only):
 *   $env:I_CONFIRM_MIGRATION_1020='YES'
 *   $env:MIGRATION_1020_TARGET='dev'   # dev | prod | both (default: both)
 *   node scripts/run-migration-1020-rds-data-api-dev-prod-cli.js
 *
 * Usage (bash):
 *   I_CONFIRM_MIGRATION_1020=YES MIGRATION_1020_TARGET=dev node scripts/run-migration-1020-rds-data-api-dev-prod-cli.js
 *
 * Requires: AWS CLI v2, credentials for account 057442119249 (or your cluster account), RDS Data API enabled.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DATABASE_NAME = process.env.RDS_DATABASE || 'warmpawz';

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1020_notification_delivery_state_machine.sql'
);

const CLUSTERS = {
  dev: {
    clusterIdentifier: 'warmpawz-dev-cluster',
    secretNameFallback: 'warmpawz-dev-rds-master-20260106164510791100000002',
  },
  prod: {
    clusterIdentifier: 'warmpawz-prod-cluster',
    secretNameFallback: 'warmpawz-prod-rds-master-20260207201049162400000001',
  },
};

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

function getClusterInfoCli(clusterIdentifier, secretNameFallback) {
  const clusterInfoJson = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterIdentifier} --region ${REGION} --output json`,
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      maxBuffer: 16 * 1024 * 1024,
    }
  );

  const clusterInfo = JSON.parse(clusterInfoJson);
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${clusterIdentifier}`);
  }

  const cluster = clusterInfo.DBClusters[0];
  const clusterArn = cluster.DBClusterArn;
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API is not enabled on ${clusterIdentifier}.`);
  }

  let secretArn = cluster.MasterUserSecret && cluster.MasterUserSecret.SecretArn;
  if (!secretArn) {
    const secretInfoJson = execSync(
      `aws secretsmanager describe-secret --secret-id "${secretNameFallback}" --region ${REGION} --output json`,
      {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    secretArn = JSON.parse(secretInfoJson).ARN;
  }

  const dbName = cluster.DatabaseName || DATABASE_NAME;
  return { clusterArn, secretArn, dbName };
}

function executeStatementCli(clusterArn, secretArn, database, sql) {
  const inputFile = path.join(__dirname, `_tmp_rds_data_1020_${Date.now()}.json`);
  const payload = {
    resourceArn: clusterArn,
    secretArn,
    database,
    sql,
  };
  fs.writeFileSync(inputFile, JSON.stringify(payload), 'utf8');
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');

  try {
    execSync(`aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      timeout: 300000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function resolveTargets() {
  const raw = (process.env.MIGRATION_1020_TARGET || 'both').toLowerCase().trim();
  if (raw === 'dev') return ['dev'];
  if (raw === 'prod') return ['prod'];
  if (raw === 'both') return ['dev', 'prod'];
  throw new Error(`Invalid MIGRATION_1020_TARGET="${raw}". Use dev | prod | both.`);
}

function main() {
  if (process.env.I_CONFIRM_MIGRATION_1020 !== 'YES') {
    console.error(
      'Refusing to run. Set exactly:\n' +
        '  I_CONFIRM_MIGRATION_1020=YES\n' +
        'Optional: MIGRATION_1020_TARGET=dev|prod|both (default both)\n' +
        'Then re-run.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('Migration file missing:', MIGRATION_FILE);
    process.exit(1);
  }

  const sqlRaw = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const statements = splitPostgresStatements(sqlRaw).filter((s) => s.trim().length > 0);

  const targets = resolveTargets();

  console.log('============================================================================');
  console.log('MIGRATION 1020 — notification delivery state machine (RDS Data API)');
  console.log(`Region: ${REGION}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log(`Statements: ${statements.length}`);
  console.log('============================================================================\n');

  for (const label of targets) {
    const cfg = CLUSTERS[label];
    console.log(`\n---------- ${label.toUpperCase()} : ${cfg.clusterIdentifier} ----------\n`);

    const { clusterArn, secretArn, dbName } = getClusterInfoCli(cfg.clusterIdentifier, cfg.secretNameFallback);
    console.log(`   Cluster ARN: ${clusterArn}`);
    console.log(`   Secret ARN:  ${secretArn}`);
    console.log(`   Database:    ${dbName}\n`);

    let ok = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.slice(0, 120).replace(/\s+/g, ' ');
      console.log(`--- [${label}] [${i + 1}/${statements.length}] ${preview}${stmt.length > 120 ? '…' : ''}`);
      try {
        executeStatementCli(clusterArn, secretArn, dbName, stmt);
        console.log('   OK\n');
        ok++;
      } catch (e) {
        const stderr = e.stderr ? e.stderr.toString() : '';
        const msg = (e.message || '') + stderr;
        if (/already exists|duplicate key|column .* already exists/i.test(msg)) {
          console.log('   Non-fatal (already applied):', msg.slice(0, 280));
          ok++;
        } else {
          console.error('   FAILED:', msg.slice(0, 800));
          process.exit(1);
        }
      }
    }

    console.log(`Done ${label}: ${ok}/${statements.length} statement(s).\n`);
  }

  console.log('============================================================================');
  console.log('All requested targets completed.');
  console.log('============================================================================');
}

main();

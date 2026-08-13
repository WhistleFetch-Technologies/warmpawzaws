#!/usr/bin/env node
/**
 * PROD: search taxonomy table seed (1031 + 1083) via RDS Data API.
 * DDL (1029) must exist first — run CREATE TABLE separately if needed.
 *
 * Usage (PowerShell):
 *   $env:I_CONFIRM_PROD_SEARCH_TAXONOMY='YES'
 *   node scripts/run-migration-search-taxonomy-prod-rds-data-api.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DATABASE_NAME = process.env.RDS_DATABASE || 'warmpawz';

const MIGRATION_FILES = [
  '1031_seed_search_taxonomy_keywords.sql',
  '1083_add_search_taxonomy_walk_nutrition_keywords.sql',
];

const PROD = {
  clusterIdentifier: 'warmpawz-prod-cluster',
  secretNameFallback: 'warmpawz-prod-rds-master-20260207201049162400000001',
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
      if (c === "'") state = 'code';
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
      if (c === "'") state = 'code';
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
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024 },
  );

  const cluster = JSON.parse(clusterInfoJson).DBClusters[0];
  if (!cluster) throw new Error(`RDS cluster not found: ${clusterIdentifier}`);
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API is not enabled on ${clusterIdentifier}.`);
  }

  let secretArn = cluster.MasterUserSecret && cluster.MasterUserSecret.SecretArn;
  if (!secretArn) {
    const secretInfoJson = execSync(
      `aws secretsmanager describe-secret --secret-id "${secretNameFallback}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024 },
    );
    secretArn = JSON.parse(secretInfoJson).ARN;
  }

  return {
    clusterArn: cluster.DBClusterArn,
    secretArn,
    dbName: cluster.DatabaseName || DATABASE_NAME,
  };
}

function executeStatementCli(clusterArn, secretArn, database, sql) {
  const inputFile = path.join(
    __dirname,
    `_tmp_rds_search_taxonomy_${Date.now()}_${Math.random().toString(36).slice(2)}.json`,
  );
  fs.writeFileSync(
    inputFile,
    JSON.stringify({ resourceArn: clusterArn, secretArn, database, sql }),
    'utf8',
  );
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

function verifyTaxonomy(clusterArn, secretArn, dbName) {
  const sql = `
SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE hub_slug = 'training')::int AS training_rows,
       COUNT(*) FILTER (WHERE keyword_normalized IN ('dog trainer','dog walk','walk my dog','diet consultation'))::int AS sample_keywords
FROM search_taxonomy_keywords
WHERE is_active = true`;
  const inputFile = path.join(__dirname, `_tmp_rds_verify_taxonomy_${Date.now()}.json`);
  fs.writeFileSync(
    inputFile,
    JSON.stringify({
      resourceArn: clusterArn,
      secretArn,
      database: dbName,
      sql,
      formatRecordsAs: 'JSON',
    }),
    'utf8',
  );
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed = JSON.parse(out);
    let records = parsed.formattedRecords;
    if (typeof records === 'string') records = JSON.parse(records);
    const row = Array.isArray(records) && records[0] ? records[0] : {};
    console.log('\nVerify search_taxonomy_keywords:');
    console.log(`  total active rows: ${row.total}`);
    console.log(`  training hub rows: ${row.training_rows}`);
    console.log(`  sample keywords:   ${row.sample_keywords}`);
    if (Number(row.total) < 100) {
      throw new Error(`Expected >= 100 active taxonomy rows, got ${row.total}`);
    }
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function main() {
  if (process.env.I_CONFIRM_PROD_SEARCH_TAXONOMY !== 'YES') {
    console.error('Refusing to run. Set: I_CONFIRM_PROD_SEARCH_TAXONOMY=YES');
    process.exit(1);
  }

  console.log('============================================================================');
  console.log('PROD search taxonomy seed — 1031 + 1083 (RDS Data API)');
  console.log(`Region: ${REGION}`);
  console.log('============================================================================\n');

  const { clusterArn, secretArn, dbName } = getClusterInfoCli(
    PROD.clusterIdentifier,
    PROD.secretNameFallback,
  );

  let totalOk = 0;
  let totalStmts = 0;

  for (const file of MIGRATION_FILES) {
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', file);
    if (!fs.existsSync(migrationPath)) {
      console.error('Missing:', migrationPath);
      process.exit(1);
    }

    const statements = splitPostgresStatements(fs.readFileSync(migrationPath, 'utf8')).filter(
      (s) => s.trim().length > 0,
    );
    console.log(`--- ${file} (${statements.length} statement(s)) ---\n`);
    totalStmts += statements.length;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.slice(0, 90).replace(/\s+/g, ' ');
      process.stdout.write(`[${i + 1}/${statements.length}] ${preview}… `);
      try {
        executeStatementCli(clusterArn, secretArn, dbName, stmt);
        console.log('OK');
        totalOk++;
      } catch (e) {
        const stderr = e.stderr ? e.stderr.toString() : '';
        const msg = (e.message || '') + stderr;
        if (/already exists|duplicate key|duplicate_object/i.test(msg)) {
          console.log('skip (already applied)');
          totalOk++;
        } else {
          console.error('\nFAILED:', msg.slice(0, 1200));
          process.exit(1);
        }
      }
    }
    console.log('');
  }

  verifyTaxonomy(clusterArn, secretArn, dbName);

  console.log('\n============================================================================');
  console.log(`Done: ${totalOk}/${totalStmts} statement(s) on PROD.`);
  console.log('============================================================================');
}

main();

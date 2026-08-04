#!/usr/bin/env node
/**
 * Pet Food subcategory migrations — PRODUCTION via RDS Data API (no VPC required).
 *
 * Usage (PowerShell):
 *   $env:I_CONFIRM_PROD_PET_FOOD_MIGRATIONS='YES'; node scripts/run-pet-food-subcategory-migrations-prod-rds-data.js
 *
 * Usage (bash):
 *   I_CONFIRM_PROD_PET_FOOD_MIGRATIONS=YES node scripts/run-pet-food-subcategory-migrations-prod-rds-data.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE_NAME = 'warmpawz';

const MIGRATION_FILES = [
  '1069_ecommerce_categories_parent_category_id.sql',
  '1068_seed_pet_food_subcategories.sql',
  '1071_seed_therapeutic_food_subcategory.sql',
  '1073_reorder_therapeutic_food_subcategory_first.sql',
  '1070_map_pet_food_products_to_subcategories.sql',
  '1072_map_therapeutic_food_products.sql',
  '1074_fix_therapeutic_food_false_positives.sql',
];

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

function getClusterInfoCli() {
  const clusterInfoJson = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_IDENTIFIER} --region ${REGION} --output json`,
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  const cluster = JSON.parse(clusterInfoJson).DBClusters[0];
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API not enabled on ${CLUSTER_IDENTIFIER}`);
  }
  const secretInfo = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  return { clusterArn: cluster.DBClusterArn, secretArn: secretInfo.ARN };
}

function executeStatementCli(clusterArn, secretArn, sql) {
  const inputFile = path.join(__dirname, `_tmp_pet_food_mig_${Date.now()}.json`);
  fs.writeFileSync(
    inputFile,
    JSON.stringify({ resourceArn: clusterArn, secretArn, database: DATABASE_NAME, sql }),
    'utf8'
  );
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');
  try {
    return execSync(
      `aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      { encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }
    );
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function isNonFatalError(msg) {
  return /already exists|duplicate key|constraint .* already exists|does not exist/i.test(msg);
}

async function main() {
  if (process.env.I_CONFIRM_PROD_PET_FOOD_MIGRATIONS !== 'YES') {
    console.error(
      'Refusing to run on PROD. Set:\n  I_CONFIRM_PROD_PET_FOOD_MIGRATIONS=YES'
    );
    process.exit(1);
  }

  console.log('Pet Food subcategory migrations — PRODUCTION (RDS Data API)\n');
  const { clusterArn, secretArn } = getClusterInfoCli();
  if (!clusterArn.includes('warmpawz-prod-cluster')) {
    throw new Error('Refusing: not prod cluster');
  }

  for (const file of MIGRATION_FILES) {
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', file);
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Missing migration: ${migrationPath}`);
    }
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);
    console.log(`\n=== ${file} (${statements.length} statement(s)) ===`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
      console.log(`  [${i + 1}/${statements.length}] ${preview}…`);
      try {
        executeStatementCli(clusterArn, secretArn, stmt);
        console.log('    OK');
      } catch (e) {
        const msg = (e.stderr ? e.stderr.toString() : '') + (e.message || '');
        if (isNonFatalError(msg)) {
          console.log('    Skipped (already applied):', msg.slice(0, 200));
        } else {
          console.error('    FAILED:', msg.slice(0, 500));
          process.exit(1);
        }
      }
    }
  }

  console.log('\n=== Verify subcategories on prod ===');
  const verifySql = `
    SELECT name, parent_category_id::text AS parent_id, display_order
    FROM ecommerce_categories
    WHERE name IN (
      'Pet Food', 'Dry Pet Food', 'Wet Pet Food', 'Puppy Food',
      'Adult Food', 'Pet Treats', 'Therapeutic Food'
    )
    ORDER BY display_order, name
  `;
  const resultJson = executeStatementCli(clusterArn, secretArn, verifySql);
  const parsed = JSON.parse(resultJson);
  const cols = (parsed.columnMetadata || []).map((c) => c.name);
  for (const rec of parsed.records || []) {
    const row = {};
    rec.forEach((f, idx) => {
      row[cols[idx]] =
        f.isNull ? null : f.stringValue ?? f.longValue ?? f.doubleValue ?? null;
    });
    console.log(`  ${row.name} | parent=${row.parent_id ?? 'null'} | order=${row.display_order}`);
  }

  console.log('\nDone — all Pet Food subcategory migrations applied on PRODUCTION.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

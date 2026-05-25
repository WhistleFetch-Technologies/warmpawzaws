#!/usr/bin/env node
/**
 * Apply migration 1019 on prod via RDS Data API (no direct VPC access).
 *
 *   node scripts/apply-migration-1019-meal-plan-tax-dedupe-prod.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN =
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DATABASE = 'warmpawz';

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!inDollarBlock && (trimmed.startsWith('--') || trimmed === '')) continue;
    if (!inDollarBlock && (trimmed.startsWith('DO $$') || trimmed.startsWith('DO $'))) {
      inDollarBlock = true;
      current += line + '\n';
      continue;
    }
    if (inDollarBlock) {
      current += line + '\n';
      if (/\$\$\s*;/.test(trimmed)) {
        inDollarBlock = false;
        if (current.trim()) statements.push(current.trim());
        current = '';
      }
      continue;
    }
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function executeSql(sql) {
  const inputFile = path.join(__dirname, '_tmp_1019_tax.json');
  fs.writeFileSync(
    inputFile,
    JSON.stringify({ resourceArn: CLUSTER_ARN, secretArn: SECRET_ARN, database: DATABASE, sql }),
    'utf8',
  );
  try {
    execSync(`aws rds-data execute-statement --cli-input-json file://${inputFile} --region ${REGION}`, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'pipe',
    });
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
    return { ok: true };
  } catch (e) {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
    const msg = (e.stderr || e.message || '').toString();
    return { ok: false, msg: msg.slice(0, 600) };
  }
}

function main() {
  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '1019_dedupe_meal_plan_tax_categories.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const stmts = splitStatements(sql);
  console.log(`1019 meal-plan tax dedupe (${stmts.length} statements)\n`);

  let failures = 0;
  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 72);
    const r = executeSql(stmts[i]);
    if (r.ok) console.log(`  [${i + 1}/${stmts.length}] OK ${preview}`);
    else {
      failures++;
      console.log(`  [${i + 1}/${stmts.length}] FAIL ${preview}`);
      console.log(`    ${r.msg}`);
    }
  }

  const verifySql = `
    SELECT category_name AS label, gst_application_scope,
           catalog_category_id IS NOT NULL AS has_catalog
    FROM tax_categories
    WHERE LOWER(TRIM(category_name)) LIKE '%meal plan%'
    ORDER BY label`;
  const vr = executeSql(verifySql);
  if (vr.ok) console.log('\nVerify query OK (see CloudWatch / rerun SELECT in console).');
  else console.log('\nVerify skipped:', vr.msg);

  if (failures) process.exit(1);
  console.log('\nDone.');
}

main();

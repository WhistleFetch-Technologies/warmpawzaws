#!/usr/bin/env node
/**
 * Run db/migrations/701_gst_catalog_category_tax_roles.sql and
 * db/migrations/625_hsn_codes_allow_duplicate_hsn_code.sql against PROD
 * using AWS CLI: aws rds-data execute-statement (one statement per call).
 *
 * Prerequisites: AWS CLI v2, credentials for account 057442119249, RDS Data API enabled on prod cluster.
 *
 * Usage:
 *   node scripts/run-migrations-625-701-prod-rds-aws-cli.js
 *
 * Optional env overrides:
 *   PROD_CLUSTER_ARN, PROD_SECRET_ARN, PROD_DATABASE_NAME, AWS_REGION
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { splitPostgresStatements } = require('./rds-data-api-utils-dev');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const CLUSTER_ARN =
  process.env.PROD_CLUSTER_ARN || 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN =
  process.env.PROD_SECRET_ARN ||
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DB_NAME = process.env.PROD_DATABASE_NAME || 'warmpawz';

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'db', 'migrations', '701_gst_catalog_category_tax_roles.sql'),
  path.join(ROOT, 'db', 'migrations', '625_hsn_codes_allow_duplicate_hsn_code.sql'),
];

/** Windows AWS CLI expects file://C:/path (two slashes), not file:///C:/... */
function toCliInputFileUrl(p) {
  const abs = path.resolve(p);
  const norm = abs.replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(norm)) return `file://${norm}`;
  return `file://${norm}`;
}

function runExecuteStatement(sql, label) {
  const tmp = path.join(
    ROOT,
    'scripts',
    `.rds-data-cli-input-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  const payload = {
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DB_NAME,
    sql: sql,
  };
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    execSync(
      `aws rds-data execute-statement --region ${REGION} --output json --no-cli-pager --cli-input-json ${JSON.stringify(toCliInputFileUrl(tmp))}`,
      { stdio: 'inherit', encoding: 'utf8' }
    );
    console.log(`   OK: ${label}\n`);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

function main() {
  console.log('PROD RDS Data API (AWS CLI)');
  console.log(`  Region:     ${REGION}`);
  console.log(`  Cluster:    ${CLUSTER_ARN}`);
  console.log(`  Database:   ${DB_NAME}\n`);

  for (const filePath of FILES) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${filePath}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    const stmts = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);
    console.log(`\n--- ${path.basename(filePath)} (${stmts.length} statement(s)) ---\n`);
    stmts.forEach((stmt, i) => {
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
      runExecuteStatement(stmt, `${path.basename(filePath)} #${i + 1}: ${preview}...`);
    });
  }

  console.log('\nDone.');
}

main();

#!/usr/bin/env node
/**
 * Pharmacy schema on PROD: aws rds-data execute-statement (one statement per call).
 * Mirrors dev: 632 (tables + trigger + logistics check), 305, 411, 508, 509, 608.
 *
 * Prerequisites: AWS CLI v2, credentials, RDS Data API enabled on warmpawz-prod-cluster.
 *
 * Usage (cmd.exe):
 *   set APPLY_PROD_PHARMACY=yes&& node scripts/run-migrations-pharmacy-prod-rds-aws-cli.js
 *
 * PowerShell:
 *   $env:APPLY_PROD_PHARMACY='yes'; node scripts/run-migrations-pharmacy-prod-rds-aws-cli.js
 *
 * Optional: PROD_CLUSTER_ARN, PROD_SECRET_ARN, PROD_DATABASE_NAME, AWS_REGION
 */

const { execSync } = require('child_process');
const fs = require('fs');
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
  path.join(ROOT, 'db', 'migrations', '632_ensure_pharmacy_orders_tables_prod.sql'),
  path.join(ROOT, 'db', 'migrations', '305_add_pharmacy_tracking_fields.sql'),
  path.join(ROOT, 'db', 'migrations', '411_add_pharmacy_broadcast_expansion_columns.sql'),
  path.join(ROOT, 'db', 'migrations', '508_pharmacy_orders_status_invoice_generated.sql'),
  path.join(ROOT, 'db', 'migrations', '509_pharmacy_payments_and_convenience.sql'),
  path.join(ROOT, 'db', 'migrations', '608_add_pharmacy_orders_columns.sql'),
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
    sql,
  };
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    execSync(
      `aws rds-data execute-statement --region ${REGION} --output json --no-cli-pager --cli-input-json ${JSON.stringify(toCliInputFileUrl(tmp))}`,
      { stdio: 'inherit', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
    console.log(`   OK: ${label}\n`);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

function main() {
  if (process.env.APPLY_PROD_PHARMACY !== 'yes') {
    console.error('Refusing to run on prod without APPLY_PROD_PHARMACY=yes');
    process.exit(1);
  }

  console.log('PROD pharmacy migrations — RDS Data API (AWS CLI)');
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

  console.log('\nDone. Pharmacy prod DDL applied.');
}

main();

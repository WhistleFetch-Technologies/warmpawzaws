#!/usr/bin/env node
/**
 * Run db/migrations/626_vendor_upi_vpa_holder_name.sql on PROD via RDS Data API (AWS CLI).
 *
 * Usage:
 *   node scripts/run-migration-626-prod-rds-aws-cli.js
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
const MIGRATION = path.join(ROOT, 'db', 'migrations', '626_vendor_upi_vpa_holder_name.sql');

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
    `.rds-data-cli-input-626-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
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
  console.log('PROD migration 626 (RDS Data API)');
  console.log(`  Region:   ${REGION}`);
  console.log(`  Cluster:  ${CLUSTER_ARN}`);
  console.log(`  Database: ${DB_NAME}\n`);

  if (!fs.existsSync(MIGRATION)) {
    console.error('Missing:', MIGRATION);
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const stmts = splitPostgresStatements(sql).filter((s) => s.trim().length > 0);
  stmts.forEach((stmt, i) => {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
    runExecuteStatement(stmt, `#${i + 1}: ${preview}...`);
  });
  console.log('Done.');
}

main();

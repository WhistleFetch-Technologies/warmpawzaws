#!/usr/bin/env node
/**
 * Apply db/migrations/1022_support_tickets_refund_columns.sql on DEV + PROD
 * via AWS CLI: aws rds-data execute-statement
 *
 *   node scripts/apply-migration-1022-support-tickets-refund-dev-prod.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DATABASE = 'warmpawz';

const TARGETS = [
  { label: 'DEV', clusterId: 'warmpawz-dev-cluster', secretId: 'warmpawz-dev-rds-master-20260106164510791100000002' },
  { label: 'PROD', clusterId: 'warmpawz-prod-cluster', secretId: 'warmpawz-prod-rds-master-20260207201049162400000001' },
];

function resolveTarget(clusterId, secretId) {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${secretId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: DATABASE };
}

function splitSql(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const noComments = raw
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function executeStatement(target, sql, tmpPath) {
  fs.writeFileSync(
    tmpPath,
    JSON.stringify({
      resourceArn: target.resourceArn,
      secretArn: target.secretArn,
      database: target.database,
      sql: sql.endsWith(';') ? sql : `${sql};`,
    }),
    'utf8'
  );
  execSync(`aws rds-data execute-statement --cli-input-json file://${tmpPath} --region ${REGION}`, {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120000,
  });
}

function verifyColumns(target, tmpPath) {
  const sql = `SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
      AND column_name IN ('refund_id', 'refund_amount', 'refund_status')
    ORDER BY column_name`;
  fs.writeFileSync(
    tmpPath,
    JSON.stringify({
      resourceArn: target.resourceArn,
      secretArn: target.secretArn,
      database: target.database,
      sql,
      formatRecordsAs: 'JSON',
    }),
    'utf8'
  );
  const out = execSync(`aws rds-data execute-statement --cli-input-json file://${tmpPath} --region ${REGION}`, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const parsed = JSON.parse(out);
  return parsed.formattedRecords ? JSON.parse(parsed.formattedRecords) : [];
}

function main() {
  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '1022_support_tickets_refund_columns.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error('Missing migration:', migrationPath);
    process.exit(1);
  }

  const statements = splitSql(migrationPath);
  const tmpPath = path.join(__dirname, '_tmp_1022_rds_input.json');
  let failed = false;

  console.log(`1022_support_tickets_refund_columns (${statements.length} statements)\n`);

  for (const { label, clusterId, secretId } of TARGETS) {
    console.log(`=== ${label} (${clusterId}) ===`);
    const target = resolveTarget(clusterId, secretId);
    for (let i = 0; i < statements.length; i++) {
      const preview = statements[i].replace(/\s+/g, ' ').slice(0, 70);
      try {
        executeStatement(target, statements[i], tmpPath);
        console.log(`  [${i + 1}/${statements.length}] OK ${preview}`);
      } catch (e) {
        failed = true;
        const msg = (e.stderr || e.message || '').toString().slice(0, 500);
        console.log(`  [${i + 1}/${statements.length}] FAIL ${preview}`);
        console.log(`    ${msg}`);
      }
    }
    try {
      const cols = verifyColumns(target, tmpPath);
      console.log('  Verify columns:', JSON.stringify(cols, null, 2));
    } catch (e) {
      failed = true;
      console.log('  Verify FAIL:', (e.stderr || e.message || '').toString().slice(0, 300));
    }
    console.log('');
  }

  try {
    fs.unlinkSync(tmpPath);
  } catch (_) {}

  if (failed) process.exit(1);
  console.log('Done — 1022 applied on DEV and PROD.');
}

main();

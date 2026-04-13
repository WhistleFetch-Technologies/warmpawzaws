#!/usr/bin/env node
/**
 * Apply db/migrations/638_book_vet_verify_predicate_loyalty_kind.sql to dev + prod RDS (Data API).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const MIGRATION = path.join(__dirname, '../db/migrations/638_book_vet_verify_predicate_loyalty_kind.sql');

const TARGETS = [
  ['DEV', 'warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002'],
  ['PROD', 'warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001'],
];

function resolveTarget(clusterId, secretId) {
  const c = JSON.parse(
    execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${secretId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return {
    resourceArn: c.DBClusterArn,
    secretArn: s.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

function splitSql(content) {
  return content
    .split(';')
    .map((s) => {
      const lines = s.split('\n').filter((line) => !/^\s*--/.test(line) && line.trim().length > 0);
      return lines.join('\n').trim();
    })
    .filter(Boolean);
}

async function runSql(client, t, label, sql) {
  await client.send(
    new ExecuteStatementCommand({
      resourceArn: t.resourceArn,
      secretArn: t.secretArn,
      database: t.database,
      sql,
    })
  );
  console.log(`OK ${label}`);
}

async function main() {
  const stmts = splitSql(fs.readFileSync(MIGRATION, 'utf8'));
  const client = new RDSDataClient({ region: REGION });
  for (const [name, clusterId, secretId] of TARGETS) {
    console.log(`\n=== ${name} (${stmts.length} statements) ===`);
    const t = resolveTarget(clusterId, secretId);
    let i = 0;
    for (const sql of stmts) {
      i += 1;
      await runSql(client, t, `${name} [${i}/${stmts.length}]`, sql);
    }
  }
  console.log('\nDone 638.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

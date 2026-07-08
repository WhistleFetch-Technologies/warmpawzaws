#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '1061_discount_policy_center_v2.sql');

async function main() {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const stmts = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  const meta = {
    resourceArn: cluster.DBClusterArn,
    secretArn: secretValue.ARN,
    database: cluster.DatabaseName || 'warmpawz',
  };
  const client = new RDSDataClient({ region: REGION });

  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Statements: ${stmts.length}`);

  const draftTableSql = `CREATE TABLE IF NOT EXISTS discount_policy_draft (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  bundle JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
)`;
  console.log('Ensuring discount_policy_draft...');
  await client.send(new ExecuteStatementCommand({ ...meta, sql: `${draftTableSql};` }));
  console.log('  OK');

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    console.log(`[${i + 1}/${stmts.length}] ${stmt.slice(0, 70).replace(/\n/g, ' ')}...`);
    await client.send(new ExecuteStatementCommand({ ...meta, sql: `${stmt};` }));
    console.log('  OK');
  }

  const verifyRes = await client.send(
    new ExecuteStatementCommand({
      ...meta,
      sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'discount_policy%' ORDER BY 1`,
      includeResultMetadata: true,
    })
  );
  const tables = (verifyRes.records || []).map((r) => r[0]?.stringValue).filter(Boolean);
  console.log('Tables:', tables.join(', '));
  console.log('Migration 1061 complete.');
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

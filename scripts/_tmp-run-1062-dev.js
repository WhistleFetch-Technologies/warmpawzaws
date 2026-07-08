#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '1062_coupons_service_targeting.sql');

async function main() {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const stmts = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^(--[^\n]*\n)+/g, '').trim())
    .filter((s) => s.length > 0);

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

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    console.log(`[${i + 1}/${stmts.length}] ${stmt.slice(0, 80).replace(/\n/g, ' ')}...`);
    await client.send(new ExecuteStatementCommand({ ...meta, sql: `${stmt};` }));
    console.log('  OK');
  }

  const verifyRes = await client.send(
    new ExecuteStatementCommand({
      ...meta,
      sql: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coupons' AND column_name IN ('applicable_to','service_category','applicable_services','metadata','usage_count','description') ORDER BY 1`,
      includeResultMetadata: true,
    })
  );
  const cols = (verifyRes.records || []).map((r) => r[0]?.stringValue).filter(Boolean);
  console.log('Verified columns:', cols.join(', '));
  console.log('Migration 1062 complete.');
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

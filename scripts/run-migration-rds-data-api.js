#!/usr/bin/env node
/**
 * Run a single migration SQL file via RDS Data API (ExecuteStatement).
 * Usage: ENVIRONMENT=prod node scripts/run-migration-rds-data-api.js 1044_backfill_vet_catalog_category_null.sql
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: ENVIRONMENT=prod node scripts/run-migration-rds-data-api.js <migration_file.sql>');
  process.exit(1);
}

const migrationPath = migrationFile.startsWith('db/')
  ? path.join(__dirname, '..', migrationFile)
  : path.join(__dirname, '..', 'db', 'migrations', migrationFile);

function rowsFromResult(result) {
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => {
      const key = cols[i] || `col_${i}`;
      if (field == null || field.isNull) row[key] = null;
      else if (field.stringValue !== undefined) row[key] = field.stringValue;
      else if (field.longValue !== undefined) row[key] = field.longValue;
      else if (field.doubleValue !== undefined) row[key] = field.doubleValue;
      else if (field.booleanValue !== undefined) row[key] = field.booleanValue;
      else row[key] = '?';
    });
    return row;
  });
}

async function main() {
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8').trim();
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' },
    ),
  );
  const cluster = clusterInfo.DBClusters[0];
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API not enabled on ${clusterId}`);
  }
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  const meta = {
    resourceArn: cluster.DBClusterArn,
    secretArn: secretValue.ARN,
    database: cluster.DatabaseName || 'warmpawz',
  };
  const client = new RDSDataClient({ region: REGION });

  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Migration: ${path.basename(migrationPath)}`);
  console.log('Executing via RDS Data API ExecuteStatement...');

  const updateRes = await client.send(
    new ExecuteStatementCommand({ ...meta, sql, includeResultMetadata: true }),
  );
  console.log(`Rows updated: ${updateRes.numberOfRecordsUpdated ?? 'n/a'}`);

  if (migrationFile.includes('1044')) {
    const verifyRes = await client.send(
      new ExecuteStatementCommand({
        ...meta,
        sql: `
          SELECT sc.id::text, sc.service_id, sc.service_name, sc.category_id, sc.category_name
          FROM service_catalog sc
          WHERE sc.id = '61d286f2-0f66-4c89-9007-88d91ae2fdab'::uuid
             OR (sc.service_id LIKE 'vet_%' AND sc.category_id = 'veterinary')
          ORDER BY sc.service_id
          LIMIT 10
        `,
        includeResultMetadata: true,
      }),
    );
    console.log('Sample rows:', JSON.stringify(rowsFromResult(verifyRes), null, 2));

    const countRes = await client.send(
      new ExecuteStatementCommand({
        ...meta,
        sql: `
          SELECT COUNT(*)::bigint AS cnt FROM service_catalog
          WHERE (category_id IS NULL OR TRIM(category_id) = '')
            AND (
              service_id LIKE 'vet_%' ESCAPE '\\'
              OR service_id LIKE '%veterinary%'
              OR service_id LIKE 'svc_veterinary%' ESCAPE '\\'
            )
        `,
        includeResultMetadata: true,
      }),
    );
    console.log('Remaining null-category vet rows:', rowsFromResult(countRes));
  }

  console.log('Migration complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});

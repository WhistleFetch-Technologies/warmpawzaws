#!/usr/bin/env node
/**
 * Read-only: list service_catalog rows with NULL category_id AND category_name on prod RDS.
 * Uses RDS Data API (works outside VPC).
 * Usage: ENVIRONMENT=prod node scripts/query-null-catalog-categories.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function cellValue(field) {
  if (field == null) return null;
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return '[blob]';
  return null;
}

function rowsFromResult(result) {
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => {
      row[cols[i] || `col_${i}`] = cellValue(field);
    });
    return row;
  });
}

async function getClusterMeta() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  if (!cluster.HttpEndpointEnabled) {
    throw new Error('RDS Data API not enabled on cluster');
  }
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  return {
    resourceArn: cluster.DBClusterArn,
    database: cluster.DatabaseName || 'warmpawz',
    secretArn: secretValue.ARN,
  };
}

async function query(client, meta, sql) {
  const res = await client.send(
    new ExecuteStatementCommand({
      resourceArn: meta.resourceArn,
      secretArn: meta.secretArn,
      database: meta.database,
      sql,
      includeResultMetadata: true,
    })
  );
  return rowsFromResult(res);
}

async function main() {
  const meta = await getClusterMeta();
  const client = new RDSDataClient({ region: REGION });

  const countRows = await query(
    client,
    meta,
    `
    SELECT COUNT(*)::int AS total_null_both
    FROM service_catalog
    WHERE category_id IS NULL
      AND (category_name IS NULL OR TRIM(category_name) = '')
    `
  );

  const services = await query(
    client,
    meta,
    `
    SELECT
      id::text,
      service_id,
      service_name,
      display_name,
      category_id,
      category_name,
      applicable_roles,
      service_style,
      status,
      publish_status,
      base_price,
      duration_minutes,
      created_at::text
    FROM service_catalog
    WHERE category_id IS NULL
      AND (category_name IS NULL OR TRIM(category_name) = '')
    ORDER BY service_name ASC
    `
  );

  console.log(
    JSON.stringify(
      {
        environment: ENVIRONMENT,
        method: 'RDS Data API',
        total_null_both: countRows[0]?.total_null_both ?? 0,
        services,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('QUERY_FAILED:', e.message || e);
  process.exit(1);
});

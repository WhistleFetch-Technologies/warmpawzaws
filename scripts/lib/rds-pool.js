/**
 * Shared RDS pool helper for commission investigation / re-resolve scripts.
 * Requires DATABASE_URL or ENVIRONMENT=dev|prod with AWS credentials.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const creds = JSON.parse(secretValue.SecretString);
  return new Pool({
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: creds.username || cluster.MasterUsername,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
}

module.exports = { getPool, ENVIRONMENT };

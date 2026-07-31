#!/usr/bin/env node
/**
 * Bootstrap DB_HOST / DB_NAME / DB_SECRET_ARN for backend/lambda rds-connection.
 * Call before dynamic import of rds-connection when running scripts locally.
 */
const { execSync } = require('child_process');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function bootstrapRdsEnv() {
  if (process.env.DB_HOST && process.env.DB_NAME) return;

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

  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  process.env.DB_HOST = endpoint;
  process.env.DB_NAME = cluster.DatabaseName || 'warmpawz';
  process.env.DB_SECRET_ARN = secretValue.ARN;
  process.env.AWS_REGION = REGION;
}

module.exports = { bootstrapRdsEnv };

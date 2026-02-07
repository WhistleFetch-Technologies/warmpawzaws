#!/usr/bin/env node
/**
 * Run pharmacy-related DB migrations in order.
 * Uses Node + pg; supports AWS RDS (cluster discovery + Secrets Manager) when DATABASE_URL is not set.
 *
 * Usage:
 *   node scripts/run-pharmacy-migrations.js [--dry-run]
 *
 * Connection (one of):
 *   - DATABASE_URL or RDS_CONNECTION  → use as connection string
 *   - Else: AWS RDS (ENVIRONMENT, AWS_REGION, AWS CLI + Secrets Manager)
 *
 * Env: ENVIRONMENT (default: dev), AWS_REGION (default: ap-south-1)
 */

const fs = require('fs');
const path = require('path');

const migrations = [
  '508_pharmacy_orders_status_invoice_generated.sql',
  '509_pharmacy_payments_and_convenience.sql',
];

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
const dryRun = process.argv.includes('--dry-run');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getRdsConnectionConfig() {
  const { execSync } = require('child_process');
  const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    throw new Error(`RDS cluster not found: ${clusterId} (region: ${REGION})`);
  }

  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';

  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';

  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  try {
    await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  } catch {
    const list = await secretsClient.send(new ListSecretsCommand({}));
    const rdsSecret = list.SecretList?.find(s => s.Name?.includes('rds-master'));
    if (rdsSecret) secretName = rdsSecret.Name;
    else throw new Error('Could not find RDS master secret in Secrets Manager');
  }

  const secretResponse = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secretValue = JSON.parse(secretResponse.SecretString || '{}');
  const password = secretValue.password || secretValue.Password;

  if (!password) {
    throw new Error('Could not retrieve database password from secret');
  }

  return {
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    max: 1,
  };
}

async function run() {
  console.log('Pharmacy migrations to apply:', migrations.join(', '));
  if (dryRun) {
    console.log('Dry run – no DB changes.');
    for (const name of migrations) {
      const file = path.join(migrationsDir, name);
      if (fs.existsSync(file)) {
        console.log('  Would run:', name);
      } else {
        console.warn('  Missing:', name);
      }
    }
    return;
  }

  let connectionString = process.env.DATABASE_URL || process.env.RDS_CONNECTION;
  let poolConfig = connectionString
    ? { connectionString }
    : null;

  if (!poolConfig) {
    console.log(`Using AWS RDS (ENVIRONMENT=${ENVIRONMENT}, AWS_REGION=${REGION})...`);
    try {
      poolConfig = await getRdsConnectionConfig();
      console.log('RDS cluster and credentials resolved.');
    } catch (err) {
      console.error('RDS setup failed:', err.message);
      console.error('Set DATABASE_URL or ensure AWS CLI and Secrets Manager access.');
      process.exit(1);
    }
  }

  const { Pool } = require('pg');
  const pool = new Pool(poolConfig);

  try {
    await pool.query('SELECT 1');
    for (const name of migrations) {
      const file = path.join(migrationsDir, name);
      if (!fs.existsSync(file)) {
        console.warn('Skip (not found):', name);
        continue;
      }
      const sql = fs.readFileSync(file, 'utf8');
      console.log('Running:', name);
      await pool.query(sql);
      console.log('  OK');
    }
    console.log('Done.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

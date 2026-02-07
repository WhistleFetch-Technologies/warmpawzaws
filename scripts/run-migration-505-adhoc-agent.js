#!/usr/bin/env node

/**
 * Run Migration 505: Adhoc Home Sample Collection Agent (AWS RDS)
 * Usage: node scripts/run-migration-505-adhoc-agent.js
 * Env: ENVIRONMENT=dev, AWS_REGION=ap-south-1
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function run() {
  console.log('\n=== Migration 505: Adhoc Sample Collection Agent ===\n');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  let endpoint, port, dbName, username;

  try {
    endpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`, { encoding: 'utf8' }).trim();
    port = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`, { encoding: 'utf8' }).trim() || '5432';
    dbName = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`, { encoding: 'utf8' }).trim() || 'warmpawz';
    username = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`, { encoding: 'utf8' }).trim() || 'warmpawz_admin';
  } catch (e) {
    console.error('Failed to get RDS info:', e.message);
    process.exit(1);
  }

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;

  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const sqlPath = path.join(__dirname, '..', 'db', 'migrations', '505_sample_collection_adhoc_agent.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Migration 505 applied successfully.\n');
  await pool.end();
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});

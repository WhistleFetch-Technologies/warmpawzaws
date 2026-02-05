#!/usr/bin/env node

/**
 * MIGRATION 537: Refund Tier – Who cancels (cancelled_by column)
 * Usage: node scripts/apply-migration-537-refund-tier-cancelled-by.js
 * With RDS: ENVIRONMENT=dev node scripts/apply-migration-537-refund-tier-cancelled-by.js
 * With DATABASE_URL: DATABASE_URL=postgresql://... node scripts/apply-migration-537-refund-tier-cancelled-by.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const DATABASE_URL = process.env.DATABASE_URL;

let DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
let DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
let DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
let DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;
let DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

async function fetchDbCredentials() {
  if (DB_USER && DB_PASSWORD) return;
  const secretName = DB_SECRET_ARN || `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!response.SecretString) throw new Error('Secret value is empty');
    const secret = JSON.parse(response.SecretString);
    DB_USER = DB_USER || secret.username || secret.Username || secret.user;
    DB_PASSWORD = secret.password || secret.Password;
    if (!DB_PASSWORD || !DB_USER) throw new Error('Missing credentials');
  } catch (e) {
    if (!DB_USER || !DB_PASSWORD) throw e;
  }
}

function getPoolConfig() {
  if (DATABASE_URL) {
    return { connectionString: DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, max: 1 };
  }
  return { host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, max: 1 };
}

async function apply() {
  if (!DATABASE_URL && (!DB_HOST || !DB_NAME)) {
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      const endpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        DB_HOST = endpoint;
        DB_PORT = parseInt(execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`, { encoding: 'utf8' }).trim() || '5432', 10);
        DB_NAME = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`, { encoding: 'utf8' }).trim() || 'warmpawz';
        DB_USER = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`, { encoding: 'utf8' }).trim() || 'warmpawz_admin';
      }
    } catch (_) {}
  }
  if (!DATABASE_URL && (!DB_HOST || !DB_NAME)) {
    console.error('Missing DB_HOST/DB_NAME or DATABASE_URL');
    process.exit(1);
  }
  if (!DATABASE_URL) await fetchDbCredentials();

  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '537_refund_tiers_cancelled_by.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = new Pool(getPoolConfig());
  await pool.query('SELECT 1');
  await pool.query(sql);
  const check = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendor_refund_tiers' AND column_name = 'cancelled_by'
  `);
  if ((check.rows || []).length === 0) {
    throw new Error('Verification failed: cancelled_by column not found');
  }
  await pool.end();
  console.log('Migration 537 (cancelled_by) complete.');
}

apply().catch((e) => { console.error(e); process.exit(1); });

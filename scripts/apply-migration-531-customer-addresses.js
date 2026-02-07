#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 531: Customer Addresses - flat_no, house_no, floor, street_name, apartment_name
 * ============================================================================
 *
 * Purpose:
 * - Add flat_no, house_no, floor, street_name, apartment_name to customer_addresses
 * - Enables Add New Address form and API to store richer address details
 *
 * Usage:
 *   node scripts/apply-migration-531-customer-addresses.js
 *
 * With RDS (AWS CLI + Secrets Manager):
 *   ENVIRONMENT=dev node scripts/apply-migration-531-customer-addresses.js
 *
 * With direct DB URL (e.g. local or CI):
 *   DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/apply-migration-531-customer-addresses.js
 *
 * Environment Variables:
 *   - DATABASE_URL: Full Postgres URL (if set, used instead of RDS/Secrets)
 *   - ENVIRONMENT: dev | stage | prod (default: dev)
 *   - DB_HOST, DB_PORT, DB_NAME: optional if AWS CLI + RDS cluster available
 *   - DB_SECRET_ARN: ARN of the secret containing DB credentials
 *   - DB_USER, DB_PASSWORD: Direct credentials (optional if DB_SECRET_ARN or DATABASE_URL set)
 *   - AWS_REGION: AWS region (default: ap-south-1)
 *   - DB_SSL: Set to 'true' for SSL (e.g. when connecting to RDS)
 * ============================================================================
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
  if (DB_USER && DB_PASSWORD) {
    console.log('✅ Using credentials from environment variables');
    return;
  }

  let secretName = DB_SECRET_ARN;
  if (!secretName) {
    secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  }

  try {
    console.log(`📥 Fetching credentials from Secrets Manager: ${secretName}`);
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    DB_USER = DB_USER || secret.username || secret.Username || secret.user;
    DB_PASSWORD = secret.password || secret.Password;

    if (!DB_PASSWORD) throw new Error('Failed to parse password from secret');
    if (!DB_USER) throw new Error('Failed to parse username from secret');

    console.log('✅ Successfully fetched credentials from Secrets Manager');
  } catch (error) {
    if (!DB_USER || !DB_PASSWORD) {
      console.error('❌ Failed to fetch credentials from Secrets Manager:', error.message);
      console.error('   Set DB_USER and DB_PASSWORD, or DB_SECRET_ARN, or DATABASE_URL');
      throw error;
    }
    console.log('⚠️  Using provided credentials');
  }
}

function getPoolConfig() {
  if (DATABASE_URL) {
    return {
      connectionString: DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 1,
    };
  }
  return {
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  };
}

async function applyMigration() {
  console.log('='.repeat(70));
  console.log('🚀 MIGRATION 531: Customer Addresses - flat_no, house_no, floor, street_name, apartment_name');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  if (DATABASE_URL) {
    console.log('Using DATABASE_URL');
  }
  console.log('');

  if (!DATABASE_URL) {
    if (!DB_HOST || !DB_NAME) {
      console.log('📊 Auto-discovering RDS cluster...');
      try {
        const { execSync } = require('child_process');
        const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

        const endpoint = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim();

        if (endpoint && endpoint !== 'None' && endpoint !== 'null' && endpoint.length > 0) {
          DB_HOST = endpoint;
          DB_PORT = parseInt(
            execSync(
              `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`,
              { encoding: 'utf8', maxBuffer: 1024 * 1024 }
            ).trim() || '5432',
            10
          );
          DB_NAME = execSync(
            `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || 'warmpawz';
          DB_USER = execSync(
            `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || 'warmpawz_admin';
          console.log('✅ RDS cluster found via AWS CLI');
        }
      } catch (e) {
        console.log('⚠️  Could not auto-discover RDS (set DB_HOST, DB_NAME, or DATABASE_URL if needed)');
      }
    }

    if (!DB_HOST || !DB_NAME) {
      console.error('❌ Missing DB_HOST or DB_NAME. Set env, or use DATABASE_URL, or ensure AWS CLI + RDS cluster.');
      process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Port: ${DB_PORT}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER || '(from secret)'}`);
    console.log('');
  }

  if (!DATABASE_URL) {
    try {
      await fetchDbCredentials();
    } catch (e) {
      console.error('❌ Credentials:', e.message);
      process.exit(1);
    }
  }

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '531_customer_addresses_extra_fields.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file: 531_customer_addresses_extra_fields.sql');
  console.log('');

  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = new Pool(getPoolConfig());

    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    console.log('');

    console.log('🔍 Pre-check: customer_addresses columns...');
    const pre = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_addresses'
        AND column_name IN ('flat_no', 'house_no', 'floor', 'street_name', 'apartment_name')
      ORDER BY column_name
    `);
    const existing = (pre.rows || []).map((r) => r.column_name);
    console.log(`   Existing columns: ${existing.length ? existing.join(', ') : 'none'}`);
    console.log('');

    console.log('📝 Applying migration...');
    await pool.query(sql);
    console.log('✅ Migration SQL executed');
    console.log('');

    console.log('🔍 Post-check: customer_addresses columns...');
    const post = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_addresses'
        AND column_name IN ('flat_no', 'house_no', 'floor', 'street_name', 'apartment_name')
      ORDER BY column_name
    `);
    const after = (post.rows || []).map((r) => `${r.column_name} (${r.data_type})`);
    console.log(`   Columns now: ${after.length ? after.join(', ') : 'none'}`);
    if (after.length < 5) {
      throw new Error('Verification failed: expected flat_no, house_no, floor, street_name, apartment_name');
    }
    console.log('');

    console.log('✅ Migration 531 (customer_addresses extra fields) complete.');
    await pool.end();
    console.log('');
    console.log('🎉 Done. Add New Address flow can now store flat/house/floor/street/apartment.');
  } catch (error) {
    console.error('');
    console.error('❌ MIGRATION FAILED:', error.message);
    if (error.stack) console.error(error.stack);
    if (pool) await pool.end();
    process.exit(1);
  }
}

applyMigration().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

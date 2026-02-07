#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 255: Service Catalog Role Assignment (Discovery & Fix)
 * ============================================================================
 *
 * Purpose:
 * - Backfill service_catalog.applicable_roles from category/service name when NULL
 * - Assign multiple roles per service type (e.g. vet_solo + vet_clinic for vet services)
 * - So vendor service management discovers the right catalog per role
 *
 * Usage:
 *   node scripts/apply-migration-255-service-catalog-role-assignment.js
 *
 * Environment Variables:
 *   - ENVIRONMENT: dev | stage | prod (default: dev)
 *   - DB_HOST: RDS database host (optional if AWS CLI + RDS cluster available)
 *   - DB_PORT: Database port (default: 5432)
 *   - DB_NAME: Database name (optional if auto-discovered)
 *   - DB_SECRET_ARN: ARN of the secret containing DB credentials
 *   - DB_USER, DB_PASSWORD: Direct credentials (optional if DB_SECRET_ARN set)
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
      console.error('   Set DB_USER and DB_PASSWORD, or DB_SECRET_ARN');
      throw error;
    }
    console.log('⚠️  Using provided credentials');
  }
}

async function applyMigration() {
  console.log('='.repeat(70));
  console.log('🚀 MIGRATION 255: Service Catalog Role Assignment');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('');

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
      console.log('⚠️  Could not auto-discover RDS (set DB_HOST, DB_NAME if needed)');
    }
  }

  if (!DB_HOST || !DB_NAME) {
    console.error('❌ Missing DB_HOST or DB_NAME. Set env or ensure AWS CLI + RDS cluster.');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Host: ${DB_HOST}`);
  console.log(`   Port: ${DB_PORT}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   User: ${DB_USER || '(from secret)'}`);
  console.log('');

  try {
    await fetchDbCredentials();
  } catch (e) {
    console.error('❌ Credentials:', e.message);
    process.exit(1);
  }

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '255_service_catalog_role_assignment.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file: 255_service_catalog_role_assignment.sql');
  console.log('');

  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    console.log('');

    console.log('🔍 Pre-check: service_catalog role assignment...');
    const pre = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE status = 'active' AND (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)) AS null_roles_count
      FROM service_catalog
    `);
    const preRow = pre.rows[0];
    const activeCount = parseInt(preRow.active_count, 10) || 0;
    const nullCount = parseInt(preRow.null_roles_count, 10) || 0;
    console.log(`   Active services: ${activeCount}`);
    console.log(`   With NULL/empty applicable_roles: ${nullCount}`);
    console.log('');

    console.log('📝 Applying migration...');
    await pool.query(sql);
    console.log('✅ Migration SQL executed');
    console.log('');

    console.log('🔍 Post-check: service_catalog role assignment...');
    const post = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE status = 'active' AND (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)) AS null_roles_count
      FROM service_catalog
    `);
    const postRow = post.rows[0];
    const postActive = parseInt(postRow.active_count, 10) || 0;
    const postNull = parseInt(postRow.null_roles_count, 10) || 0;
    console.log(`   Active services: ${postActive}`);
    console.log(`   With NULL/empty applicable_roles: ${postNull} (expected 0)`);
    console.log('');

    if (postNull > 0) {
      console.log('⚠️  Some active services still have NULL applicable_roles (review categories/names).');
    } else {
      console.log('✅ All active service_catalog rows have applicable_roles set.');
    }

    await pool.end();
    console.log('');
    console.log('🎉 Migration 255 (service catalog role assignment) complete.');
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

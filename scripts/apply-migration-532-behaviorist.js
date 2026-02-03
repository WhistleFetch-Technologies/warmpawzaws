#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 532: Behaviorist Role (same as Trainer)
 * ============================================================================
 *
 * Purpose:
 * - Add roles behaviorist_solo, behaviorist_center (active, same config as trainer)
 * - Copy role_permissions, onboarding_forms from trainer
 * - Seed service_catalog for Behaviorist
 *
 * Usage:
 *   node scripts/apply-migration-532-behaviorist.js
 *
 * With RDS (AWS CLI + Secrets Manager):
 *   ENVIRONMENT=dev node scripts/apply-migration-532-behaviorist.js
 *
 * With direct DB URL:
 *   DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/apply-migration-532-behaviorist.js
 *
 * Environment Variables:
 *   - DATABASE_URL: Full Postgres URL (if set, used instead of RDS/Secrets)
 *   - ENVIRONMENT: dev | stage | prod (default: dev)
 *   - AWS_REGION: default ap-south-1
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

  const secretName = DB_SECRET_ARN || `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  try {
    console.log(`📥 Fetching credentials from Secrets Manager: ${secretName}`);
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) throw new Error('Secret value is empty');

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
  console.log('🚀 MIGRATION 532: Behaviorist Role (same as Trainer)');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  if (DATABASE_URL) console.log('Using DATABASE_URL');
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
    '532_behaviorist_role_same_as_trainer.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file: 532_behaviorist_role_same_as_trainer.sql');
  console.log('');

  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = new Pool(getPoolConfig());

    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    console.log('');

    console.log('🔍 Pre-check: roles behaviorist_solo, behaviorist_center...');
    const preRoles = await pool.query(
      `SELECT name, is_active FROM roles WHERE name IN ('behaviorist_solo', 'behaviorist_center')`
    );
    const existingRoles = (preRoles.rows || []).map((r) => r.name);
    console.log(`   Existing: ${existingRoles.length ? existingRoles.join(', ') : 'none'}`);
    console.log('');

    console.log('📝 Applying migration...');
    await pool.query(sql);
    console.log('✅ Migration SQL executed');
    console.log('');

    console.log('🔍 Post-check: roles and service_catalog...');
    const postRoles = await pool.query(
      `SELECT name, display_name, is_active FROM roles WHERE name IN ('behaviorist_solo', 'behaviorist_center')`
    );
    const rolesAfter = postRoles.rows || [];
    console.log(`   Roles: ${rolesAfter.length} (behaviorist_solo, behaviorist_center)`);
    if (rolesAfter.length > 0) {
      rolesAfter.forEach((r) => console.log(`      - ${r.name}: ${r.display_name} (active: ${r.is_active})`));
    }

    const catalogCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM service_catalog WHERE 'pet_behaviorist' = ANY(applicable_roles) OR 'behaviorist_solo' = ANY(applicable_roles)`
    );
    const count = parseInt((catalogCount.rows && catalogCount.rows[0] && catalogCount.rows[0].cnt) || '0', 10);
    console.log(`   Service catalog entries for behaviorist: ${count}`);
    if (count < 1) {
      console.log('   ⚠️  No behaviorist services found; migration may have skipped inserts (e.g. ON CONFLICT).');
    }
    console.log('');

    console.log('✅ Migration 532 (Behaviorist role) complete.');
    await pool.end();
    console.log('');
    console.log('🎉 Done. Next: run POST /admin/roles/seed?updateOnly=false to sync role config if needed.');
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

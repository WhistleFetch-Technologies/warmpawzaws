#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATIONS 733 + 734: Bookings pending_payment + diagnostics reconciliation docs
 * ============================================================================
 *
 * 733: Adds `pending_payment` to bookings.status CHECK constraint (required for
 *     bookings-enhanced pending_payment flow).
 *
 * 734: Documentation / manual SQL templates only — no DDL in repo file. This
 *     script logs the path and skips execution for 734.
 *
 * Usage:
 *   node scripts/apply-migration-733-734-diagnostics-bookings.js
 *
 * Environment (same pattern as apply-migration-523):
 *   - ENVIRONMENT: dev | stage | prod (default: dev)
 *   - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD — or DB_SECRET_ARN
 *   - AWS_REGION (default ap-south-1), DB_SSL=true for RDS
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
  console.log('🚀 MIGRATIONS 733 (+ 734 documentation)');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('');

  const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!DB_HOST || !DB_NAME) {
    console.log('📊 Auto-discovering RDS cluster...');
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      const aws =
        process.platform === 'win32'
          ? process.env.AWS_CLI || 'aws.cmd'
          : 'aws';

      const endpoint = execSync(
        `${aws} rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      ).trim();

      if (endpoint && endpoint !== 'None' && endpoint !== 'null' && endpoint.length > 0) {
        DB_HOST = endpoint;
        DB_PORT = parseInt(
          execSync(
            `${aws} rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || '5432',
          10
        );
        DB_NAME =
          execSync(
            `${aws} rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || 'warmpawz';
        DB_USER =
          execSync(
            `${aws} rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || 'warmpawz_admin';
        console.log('✅ RDS cluster found via AWS CLI');
      }
    } catch (e) {
      console.log('⚠️  Could not auto-discover RDS (set DB_HOST, DB_NAME if needed)');
    }
  }

  if ((!DB_HOST || !DB_NAME) && !DATABASE_URL) {
    console.error('❌ Missing DB connection. Use one of:');
    console.error('   • DATABASE_URL or POSTGRES_URL (recommended for local / CI)');
    console.error('   • DB_HOST + DB_NAME + credentials (or DB_SECRET_ARN)');
    console.error('   • AWS CLI on PATH (aws or aws.cmd on Windows) + warmpawz-<ENV>-cluster');
    process.exit(1);
  }

  if (DATABASE_URL) {
    console.log('📋 Using DATABASE_URL / POSTGRES_URL (host hidden)');
  } else {
    console.log('📋 Configuration:');
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Port: ${DB_PORT}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER || '(from secret)'}`);
  }
  console.log('');

  if (!DATABASE_URL) {
    try {
      await fetchDbCredentials();
    } catch (e) {
      console.error('❌ Credentials:', e.message);
      process.exit(1);
    }
  }

  const migration733 = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '733_add_pending_payment_to_bookings_status_check.sql'
  );
  const migration734 = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '734_diagnostics_pending_payment_reconciliation.sql'
  );

  if (!fs.existsSync(migration733)) {
    console.error('❌ Migration file not found:', migration733);
    process.exit(1);
  }

  const sql733 = fs.readFileSync(migration733, 'utf8');

  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = DATABASE_URL
      ? new Pool({
          connectionString: DATABASE_URL,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          max: 1,
        })
      : new Pool({
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

    console.log('🔍 Pre-check: bookings_status_check allows pending_payment?');
    const pre = await pool.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.bookings'::regclass
        AND conname = 'bookings_status_check'
      LIMIT 1
    `);
    if (pre.rows[0]?.def) {
      const d = String(pre.rows[0].def);
      console.log(`   Current: ${d.slice(0, 200)}${d.length > 200 ? '…' : ''}`);
      if (d.includes('pending_payment')) {
        console.log('');
        console.log('✅ Constraint already includes pending_payment — 733 likely applied. Skipping execute.');
        await pool.end();
        console.log('');
        console.log('📄 734 (reconciliation templates only):', migration734);
        console.log('   Open that file in an SQL client; uncomment SELECTs / manual UPDATE when fixing legacy rows.');
        return;
      }
    } else {
      console.log('   (No bookings_status_check found — will attempt 733 DDL.)');
    }
    console.log('');

    console.log('📝 Applying migration 733...');
    await pool.query(sql733);
    console.log('✅ Migration 733 SQL executed');
    console.log('');

    console.log('🔍 Post-check: bookings_status_check');
    const post = await pool.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.bookings'::regclass
        AND conname = 'bookings_status_check'
      LIMIT 1
    `);
    if (post.rows[0]?.def) {
      const d = String(post.rows[0].def);
      console.log(`   Now: ${d.slice(0, 240)}${d.length > 240 ? '…' : ''}`);
    }
    console.log('');

    await pool.end();
    console.log('🎉 Migration 733 complete.');
    console.log('');
    console.log('📄 734 (documentation / manual reconciliation only):');
    console.log(`   ${migration734}`);
    console.log('   No automated SQL to run. Use commented templates after reviewing prod data.');
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

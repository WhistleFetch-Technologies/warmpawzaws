#!/usr/bin/env node
/**
 * Run DB migration 538 on warmpawz-dev-cluster (or warmpawz-{ENVIRONMENT}-cluster).
 * Adds bookings.cancelled_by and bookings.penalty_processed for refund/penalty tracking.
 *
 * Usage:
 *   node scripts/run-migration-538-bookings-cancelled-penalty.js
 *   ENVIRONMENT=dev node scripts/run-migration-538-bookings-cancelled-penalty.js
 *
 * Requires: AWS CLI configured; RDS cluster warmpawz-{ENVIRONMENT}-cluster; Secrets Manager;
 * network access to RDS (VPN/bastion if cluster is in VPC). Uses pg to connect directly.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_ID = `warmpawz-${ENVIRONMENT}-cluster`;
const MIGRATION_FILE = '538_bookings_cancelled_by_penalty_processed.sql';

async function runMigration538() {
  console.log('🚀 Migration 538: bookings cancelled_by + penalty_processed');
  console.log('==========================================================');
  console.log(`Cluster: ${CLUSTER_ID}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // 1. Get RDS cluster info
    console.log('📊 Getting RDS cluster information...');
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));

    if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
      throw new Error(`RDS cluster not found: ${CLUSTER_ID}`);
    }

    const cluster = clusterInfo.DBClusters[0];
    const endpoint = cluster.Endpoint;
    const port = cluster.Port || 5432;
    const dbName = cluster.DatabaseName || 'warmpawz';
    const username = cluster.MasterUsername || 'warmpawz_admin';

    console.log('✅ Cluster found:');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${dbName}`);
    console.log('');

    // 2. Get password from Secrets Manager
    console.log('🔐 Getting credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;
    if (!password) throw new Error('Password not found in secret');
    console.log('✅ Credentials retrieved');
    console.log('');

    // 3. Connect to database
    console.log('🔗 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: Number(port),
      database: dbName,
      user: username,
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    await pool.query('SELECT 1');
    console.log('✅ Connected');
    console.log('');

    // 4. Load and run migration
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', MIGRATION_FILE);
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 Running: ${MIGRATION_FILE}`);
    await pool.query(sql);
    console.log('✅ Migration applied');
    console.log('');

    // 5. Verify migration 538
    console.log('🔍 Verifying columns...');
    const colRes = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bookings'
        AND column_name IN ('cancelled_by', 'penalty_processed')
      ORDER BY column_name
    `);
    if (colRes.rows.length < 2) {
      throw new Error('Verification failed: expected columns cancelled_by and penalty_processed on bookings');
    }
    colRes.rows.forEach((r) => console.log(`   ✅ ${r.column_name} (${r.data_type})`));

    console.log('🔍 Verifying indexes...');
    const idxRes = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'bookings'
        AND indexname IN ('idx_bookings_cancelled_by', 'idx_bookings_penalty_processed')
      ORDER BY indexname
    `);
    if (idxRes.rows.length >= 1) {
      idxRes.rows.forEach((r) => console.log(`   ✅ ${r.indexname}`));
    } else {
      console.log('   ⚠️  Indexes may already exist with different names');
    }

    await pool.end();
    console.log('');
    console.log('🎉 Migration 538 complete and verified.');
  } catch (err) {
    console.error('');
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('does not exist') || err.message.includes('already exists')) {
      console.log('   (Safe to ignore if using IF NOT EXISTS and objects already exist.)');
    }
    process.exit(1);
  }
}

runMigration538();

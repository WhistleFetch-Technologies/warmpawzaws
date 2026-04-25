#!/usr/bin/env node
/**
 * Run DB migration 730 on warmpawz-{ENVIRONMENT}-cluster.
 * Expands banners.type CHECK constraint for home_top, home_middle, checkout.
 *
 * Usage:
 *   node scripts/run-migration-730-banners-type.js
 *   ENVIRONMENT=dev node scripts/run-migration-730-banners-type.js
 *   ENVIRONMENT=prod node scripts/run-migration-730-banners-type.js
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
const MIGRATION_FILE = '730_banners_expand_type_check.sql';

async function runMigration730() {
  console.log('🚀 Migration 730: banners_type_check (placement types)');
  console.log('=======================================================');
  console.log(`Cluster: ${CLUSTER_ID}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    console.log('📊 Getting RDS cluster information...');
    const clusterInfo = JSON.parse(
      execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    );

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

    console.log('🔐 Getting credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName =
      ENVIRONMENT === 'prod'
        ? 'warmpawz-prod-rds-master-20260207201049162400000001'
        : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

    const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;
    if (!password) throw new Error('Password not found in secret');
    console.log('✅ Credentials retrieved');
    console.log('');

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

    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', MIGRATION_FILE);
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 Running: ${MIGRATION_FILE}`);
    await pool.query(sql);
    console.log('✅ Migration applied');
    console.log('');

    console.log('🔍 Verifying check constraint...');
    const chk = await pool.query(`
      SELECT pg_get_constraintdef(c.oid, true) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'banners'
        AND c.conname = 'banners_type_check'
    `);
    if (!chk.rows.length) {
      throw new Error('Verification failed: banners_type_check not found on public.banners');
    }
    console.log(`   ✅ ${chk.rows[0].def}`);

    await pool.end();
    console.log('');
    console.log('🎉 Migration 730 complete and verified.');
  } catch (err) {
    console.error('');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration730();

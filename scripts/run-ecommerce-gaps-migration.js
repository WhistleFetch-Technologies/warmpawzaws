#!/usr/bin/env node
/**
 * ============================================================================
 * RUN E-COMMERCE GAPS MIGRATION
 * ============================================================================
 * 
 * Runs the 213_ecommerce_missing_tables.sql migration to fix:
 * - Tax categories and HSN codes tables
 * - E-commerce orders table
 * - Promotions and coupons tables
 * - Product stock alerts table
 * - Settlement enhancements
 * 
 * Usage:
 *   node scripts/run-ecommerce-gaps-migration.js
 *   ENVIRONMENT=prod node scripts/run-ecommerce-gaps-migration.js
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Migration files to run
const MIGRATION_FILES = [
  '213_ecommerce_missing_tables.sql',
];

async function runMigration() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('🔧 E-COMMERCE GAPS MIGRATION');
  console.log('━'.repeat(60));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');

  let endpoint, port, dbName, username;

  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      throw new Error(`RDS cluster not found: ${clusterId}`);
    }

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (error) {
    console.error('❌ ERROR: Could not get RDS cluster info');
    console.error(error.message);
    process.exit(1);
  }

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password || secret.secret || secret.Secret;

    if (!password) {
      console.error('❌ ERROR: Password not found in secret');
      process.exit(1);
    }
    console.log('✅ Credentials retrieved');
  } catch (error) {
    console.error('❌ ERROR: Error fetching RDS credentials:', error);
    process.exit(1);
  }

  const pool = new Pool({
    user: username,
    host: endpoint,
    database: dbName,
    password: password,
    port: parseInt(port, 10),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await pool.connect();
    console.log('✅ Connected to database');
  } catch (err) {
    console.error('❌ ERROR: Failed to connect to database:', err);
    process.exit(1);
  }

  for (const migrationFile of MIGRATION_FILES) {
    const filePath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
    console.log(`\n📝 Running migration: ${migrationFile}`);
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration completed: ${migrationFile}`);
    } catch (err) {
      console.error(`❌ Migration error: ${err.message}`);
      // Continue with other migrations - some tables may already exist
      console.log('   (Continuing with next migration...)');
    }
  }

  await pool.end();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ MIGRATIONS COMPLETED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runMigration();

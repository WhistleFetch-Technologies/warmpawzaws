#!/usr/bin/env node
/**
 * Run Wishlist and Product Variations Migration on AWS RDS
 * Migrations: 212_wishlist_and_variations.sql
 * 
 * Features:
 * - Customer wishlist
 * - Product variations (size, color, weight)
 * - Variation options with pricing
 * - Product views tracking
 * - Persistent cart items
 * 
 * Date: 2026-01-20
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Migration files to run
const MIGRATION_FILES = [
  '212_wishlist_and_variations.sql',
];

async function runMigration() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('❤️ WISHLIST & PRODUCT VARIATIONS MIGRATION');
  console.log('━'.repeat(60));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
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
    console.log('');
  } catch (error) {
    console.error('❌ ERROR: Could not get database password');
    console.error(error.message);
    process.exit(1);
  }

  // Create database connection
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  const client = await pool.connect();
  console.log('✅ Connected to database');
  console.log('');

  try {
    for (const migrationFile of MIGRATION_FILES) {
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️ Migration file not found: ${migrationFile}`);
        continue;
      }

      console.log(`📝 Running migration: ${migrationFile}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      await client.query(sql);
      console.log(`✅ Migration completed: ${migrationFile}`);
      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('━'.repeat(60));
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

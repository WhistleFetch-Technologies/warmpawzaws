#!/usr/bin/env node
/**
 * Run Migration 535: Fix Missing vendor_identity
 * Standalone script to run the migration directly
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 535: Fix Missing vendor_identity - AWS RDS');
  console.log('========================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

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
  
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;

    if (!password) {
      console.error('❌ ERROR: Password not found in secret');
      process.exit(1);
    }

    console.log('✅ Credentials retrieved');
    console.log('');

    // Connect to database
    console.log('🔗 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: parseInt(port, 10),
      database: dbName,
      user: username,
      password: password,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Read migration file
    console.log('⚙️  Running migration...');
    console.log('─────────────────────────');
    
    const migrationFile = '535_fix_missing_vendor_identity.sql';
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
    
    console.log(`📄 Migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(sql);
    console.log('✅ Migration completed!');
    console.log('');

    // Verification
    console.log('🔍 Verifying migration...');
    const verifyResult = await pool.query(`
      SELECT 
        vi.id as vendor_identity_id,
        vi.vendor_id,
        vi.application_id,
        vi.onboarding_status,
        v.id as vendor_id_check,
        v.vendor_identity_id as vendor_vendor_identity_id,
        voa.id as application_id_check,
        voa.vendor_identity_id as application_vendor_identity_id
      FROM vendor_identity vi
      LEFT JOIN vendors v ON v.id = vi.id
      LEFT JOIN vendor_onboarding_applications voa ON voa.id = vi.application_id
      WHERE vi.id = '92124449-84c1-42ad-83ab-e6a7e0ee3744'
    `);
    
    if (verifyResult.rows.length > 0) {
      const row = verifyResult.rows[0];
      console.log('✅ Verification results:');
      console.log(`   vendor_identity.id: ${row.vendor_identity_id}`);
      console.log(`   vendor_identity.vendor_id: ${row.vendor_id || 'NULL'}`);
      console.log(`   vendor_identity.application_id: ${row.application_id || 'NULL'}`);
      console.log(`   vendor_identity.onboarding_status: ${row.onboarding_status}`);
      console.log(`   vendors.vendor_identity_id: ${row.vendor_vendor_identity_id || 'NULL'}`);
      console.log(`   application.vendor_identity_id: ${row.application_vendor_identity_id || 'NULL'}`);
    } else {
      console.log('⚠️  Vendor identity not found after migration');
    }

    await pool.end();
    console.log('');
    console.log('🎉 Migration and verification complete!');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

runMigration();

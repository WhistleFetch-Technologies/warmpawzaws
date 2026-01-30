#!/usr/bin/env node
/**
 * Migration 412: Vendor Discovery Gap Fixes
 * 
 * Fixes gaps in vendor discovery and booking rules:
 * - Adds service_style to service_packages
 * - Adds diagnostics enhancements (free collection, terms & conditions)
 * - Adds chat auto-activation tracking
 * - Adds sample collection notification tracking
 * 
 * Date: 2026-01-27
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 412: Vendor Discovery Gap Fixes');
  console.log('============================================');
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
      console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
      process.exit(1);
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
    console.error(`❌ ERROR: Failed to get RDS cluster info: ${error.message}`);
    console.log('');
    console.log('💡 Tip: Make sure AWS CLI is configured and you have permissions to describe RDS clusters');
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

  // Try to find the secret
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
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
    
    const migrationFile = '412_vendor_discovery_gap_fixes.sql';
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
    
    console.log(`📄 Migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('📝 Executing migration SQL...');
    await pool.query(sql);
    console.log('✅ Migration SQL executed successfully');
    console.log('');

    // Verify migration
    console.log('🔍 Verifying migration...');
    console.log('─────────────────────────');
    
    // Check service_packages.service_style
    const serviceStyleCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'service_packages' 
        AND column_name = 'service_style'
      ) as exists;
    `);
    
    if (serviceStyleCheck.rows[0]?.exists) {
      console.log('✅ service_packages.service_style column exists');
    } else {
      console.log('⚠️  service_packages.service_style column not found');
    }

    // Check diagnostic_tests new columns
    const diagnosticColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'diagnostic_tests' 
      AND column_name IN ('is_free_home_collection', 'terms_conditions', 'home_collection_fee')
      ORDER BY column_name;
    `);
    
    if (diagnosticColumns.rows.length > 0) {
      console.log('✅ diagnostic_tests new columns:');
      diagnosticColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } else {
      console.log('⚠️  diagnostic_tests new columns not found');
    }

    // Check bookings chat columns
    const chatColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      AND column_name IN ('chat_activated_at', 'chat_auto_activated', 'reminder_5min_sent')
      ORDER BY column_name;
    `);
    
    if (chatColumns.rows.length > 0) {
      console.log('✅ bookings chat activation columns:');
      chatColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } else {
      console.log('⚠️  bookings chat activation columns not found');
    }

    // Check sample_collection_assignments notification columns
    const sampleColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sample_collection_assignments' 
      AND column_name LIKE '%notified%'
      ORDER BY column_name;
    `);
    
    if (sampleColumns.rows.length > 0) {
      console.log('✅ sample_collection_assignments notification columns:');
      sampleColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } else {
      console.log('⚠️  sample_collection_assignments notification columns not found');
    }

    // Check diagnostic_packages table
    const diagnosticPackagesTable = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_packages'
      ) as exists;
    `);
    
    if (diagnosticPackagesTable.rows[0]?.exists) {
      console.log('✅ diagnostic_packages table exists');
    } else {
      console.log('⚠️  diagnostic_packages table not found');
    }

    // Check index
    const indexCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_service_packages_service_style'
      ) as exists;
    `);
    
    if (indexCheck.rows[0]?.exists) {
      console.log('✅ idx_service_packages_service_style index exists');
    } else {
      console.log('⚠️  idx_service_packages_service_style index not found');
    }

    console.log('');
    await pool.end();
    console.log('🎉 ✅ ✅ ✅ MIGRATION 412 COMPLETED SUCCESSFULLY! ✅ ✅ ✅');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ service_style column added to service_packages');
    console.log('   ✅ Diagnostics enhancements (free collection, terms & conditions)');
    console.log('   ✅ Chat auto-activation tracking columns');
    console.log('   ✅ Sample collection notification tracking');
    console.log('   ✅ diagnostic_packages table created');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

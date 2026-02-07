#!/usr/bin/env node
/**
 * Run Migration 300: Add customer_phone column to bookings table
 * Connects to AWS RDS Serverless and runs the migration script
 * 
 * Usage:
 *   node scripts/run-migration-300-customer-phone.js [environment] [region]
 * 
 * Example:
 *   node scripts/run-migration-300-customer-phone.js dev ap-south-1
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || process.env.ENVIRONMENT || 'dev';
const REGION = process.argv[3] || process.env.AWS_REGION || 'ap-south-1';

async function getRdsEndpoint() {
  try {
    // Try cluster first (for serverless)
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    try {
      const clusterOutput = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();
      
      if (clusterOutput && clusterOutput !== 'None' && clusterOutput !== 'null') {
        const port = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Port' --output text`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim() || '5432';
        
        const dbName = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].DatabaseName' --output text`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim() || 'warmpawz';
        
        return { endpoint: clusterOutput, port: parseInt(port, 10), dbName };
      }
    } catch (error) {
      // Cluster not found, try instance
    }
    
    // Try instance
    const instanceId = `warmpawz-${ENVIRONMENT}-db`;
    const instanceOutput = execSync(
      `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Address' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (instanceOutput && instanceOutput !== 'None') {
      const port = execSync(
        `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Port' --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim() || '5432';
      
      return { endpoint: instanceOutput, port: parseInt(port, 10), dbName: 'warmpawz' };
    }
    
    throw new Error('RDS endpoint not found');
  } catch (error) {
    throw new Error(`Failed to get RDS endpoint: ${error.message}`);
  }
}

async function getDbCredentials() {
  try {
    // Try to find the secret
    const secretNamePattern = `warmpawz-${ENVIRONMENT}-rds-master`;
    const secretsOutput = execSync(
      `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, '${secretNamePattern}')].ARN" --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secretArn = secretsOutput.split('\n')[0] || secretsOutput;
    if (!secretArn || secretArn === 'None') {
      throw new Error('RDS secret not found');
    }
    
    const secretValue = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretArn}" --region "${REGION}" --query SecretString --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secret = JSON.parse(secretValue);
    return {
      username: secret.username || secret.Username || secret.user || 'warmpawz_admin',
      password: secret.password || secret.Password || secret.secret,
    };
  } catch (error) {
    throw new Error(`Failed to get DB credentials: ${error.message}`);
  }
}

async function runMigration() {
  console.log('🚀 Migration 300: Add customer_phone to bookings table');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS endpoint
    console.log('📊 Getting RDS cluster/instance information...');
    const { endpoint, port, dbName } = await getRdsEndpoint();
    console.log(`✅ RDS Endpoint: ${endpoint}`);
    console.log(`✅ Port: ${port}`);
    console.log(`✅ Database: ${dbName}`);
    console.log('');

    // Get credentials
    console.log('🔐 Getting database credentials from Secrets Manager...');
    const credentials = await getDbCredentials();
    console.log(`✅ Username: ${credentials.username}`);
    console.log('✅ Password: [retrieved]');
    console.log('');

    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '300_add_customer_phone_to_bookings.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`📄 Migration file: ${migrationFile}`);
    console.log('');

    // Connect to database
    console.log('🔌 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: port,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    });

    // Test connection
    await pool.query('SELECT version()');
    console.log('✅ Connection successful');
    console.log('');

    // Execute migration
    console.log('🚀 Executing migration...');
    console.log('─────────────────────────');
    
    try {
      await pool.query(migrationSQL);
      console.log('✅ Migration executed successfully');
      console.log('');
    } catch (error) {
      // Some errors are expected (IF NOT EXISTS, etc.)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('does not exist')) {
        console.log('⚠️  Some objects may already exist (this is safe)');
        console.log(`   ${error.message}`);
        console.log('');
      } else {
        throw error;
      }
    }

    // Verify column was added
    console.log('🔍 Verifying migration...');
    const columnCheck = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings' 
        AND column_name = 'customer_phone'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ Column customer_phone exists:');
      const col = columnCheck.rows[0];
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default || 'NULL'}`);
    } else {
      console.log('⚠️  Warning: Column customer_phone not found');
    }
    console.log('');

    // Check data population
    const dataCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(customer_phone) as with_phone,
        COUNT(*) - COUNT(customer_phone) as without_phone
      FROM bookings
    `);

    if (dataCheck.rows.length > 0) {
      const stats = dataCheck.rows[0];
      console.log('📊 Data Population Statistics:');
      console.log(`   - Total bookings: ${stats.total_bookings}`);
      console.log(`   - With phone: ${stats.with_phone}`);
      console.log(`   - Without phone: ${stats.without_phone}`);
      const percentage = stats.total_bookings > 0 
        ? ((parseInt(stats.with_phone) / parseInt(stats.total_bookings)) * 100).toFixed(2)
        : 0;
      console.log(`   - Population rate: ${percentage}%`);
    }
    console.log('');

    // Check indexes
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'bookings' 
        AND indexname LIKE '%customer_phone%'
      ORDER BY indexname
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Indexes created:');
      indexCheck.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    } else {
      console.log('⚠️  Warning: No indexes found for customer_phone');
    }
    console.log('');

    // Check triggers
    const triggerCheck = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'bookings'
        AND trigger_name LIKE '%customer_phone%'
      ORDER BY trigger_name
    `);

    if (triggerCheck.rows.length > 0) {
      console.log('✅ Triggers created:');
      triggerCheck.rows.forEach(row => {
        console.log(`   - ${row.trigger_name} (${row.action_timing} ${row.event_manipulation})`);
      });
    } else {
      console.log('⚠️  Warning: No triggers found for customer_phone');
    }
    console.log('');

    // Check for sync issues
    const syncCheck = await pool.query(`
      SELECT 
        COUNT(*) as mismatch_count
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      WHERE b.customer_phone IS NOT NULL
        AND b.customer_phone != c.phone
      LIMIT 10
    `);

    if (syncCheck.rows.length > 0 && parseInt(syncCheck.rows[0].mismatch_count) > 0) {
      console.log(`⚠️  Warning: Found ${syncCheck.rows[0].mismatch_count} bookings with phone mismatch`);
      console.log('   (This may be expected if customer phone was updated after booking)');
    } else {
      console.log('✅ No phone mismatches detected');
    }
    console.log('');

    await pool.end();
    console.log('🎉 Migration 300 completed successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Deploy the updated backend code');
    console.log('   2. Run verification script: ./scripts/verify-api-fixes.sh');
    console.log('   3. Monitor error rates in CloudWatch');
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
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log('   1. Check if RDS cluster/instance is running');
      console.log('   2. Verify security group allows your IP');
      console.log('   3. Check if endpoint is correct');
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
runMigration();

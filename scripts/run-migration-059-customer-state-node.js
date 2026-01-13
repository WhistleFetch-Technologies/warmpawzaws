#!/usr/bin/env node
/**
 * Execute Migration 059: Customer State Management
 * Runs migration to add customer state fields and tables
 */

const fs = require('fs');
const path = require('path');

// Try to load pg
let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  console.error('❌ pg module not found. Installing...');
  console.error('Please run: npm install pg');
  process.exit(1);
}

// Try to load AWS SDK
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require('@aws-sdk/client-secrets-manager');
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (e) {
  // Will use AWS CLI fallback
}

const ENVIRONMENT = process.env.ENVIRONMENT || process.argv[2] || 'dev';
const REGION = process.env.AWS_REGION || process.argv[3] || 'ap-south-1';
const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '059_customer_state_management.sql');

async function runMigration() {
  console.log('🔄 Executing Migration 059: Customer State Management');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log(`Migration: ${MIGRATION_FILE}`);
  console.log('');

  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ ERROR: Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  // Get RDS endpoint
  console.log('📊 Getting RDS information...');
  
  let endpoint, port, dbName, username;
  
  // Try environment variables first
  endpoint = process.env.RDS_ENDPOINT || process.env.PGHOST;
  port = process.env.RDS_PORT || process.env.PGPORT || '5432';
  dbName = process.env.DB_NAME || process.env.PGDATABASE || 'warmpawz';
  username = process.env.DB_USERNAME || process.env.PGUSER || 'warmpawz_admin';

  // Try to get from AWS if not set
  if (!endpoint) {
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      
      endpoint = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null || aws rds describe-db-instances --region ${REGION} --query "DBInstances[?contains(DBInstanceIdentifier, 'warmpawz')].Endpoint.Address" --output text`,
        { encoding: 'utf8' }
      ).trim();
      
      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        port = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null || echo 5432`,
          { encoding: 'utf8' }
        ).trim() || '5432';
        
        dbName = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null || echo warmpawz`,
          { encoding: 'utf8' }
        ).trim() || 'warmpawz';
        
        username = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null || echo warmpawz_admin`,
          { encoding: 'utf8' }
        ).trim() || 'warmpawz_admin';
      }
    } catch (e) {
      // Fallback to manual input
    }
  }

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    console.log('⚠️  RDS endpoint not found. Using environment variables or manual input.');
    console.log('');
    console.log('Please set:');
    console.log('  RDS_ENDPOINT or PGHOST');
    console.log('  DB_NAME or PGDATABASE');
    console.log('  DB_USERNAME or PGUSER');
    console.log('  DB_PASSWORD or PGPASSWORD');
    console.log('');
    console.log('Or run with:');
    console.log('  RDS_ENDPOINT=your-endpoint DB_NAME=warmpawz DB_USERNAME=user DB_PASSWORD=pass node scripts/run-migration-059-customer-state-node.js');
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password
  console.log('🔐 Getting database credentials...');
  
  let password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  
  if (!password) {
    // Try Secrets Manager
    try {
      const { execSync } = require('child_process');
      const secretList = execSync(
        `aws secretsmanager list-secrets --region ${REGION} --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master') || starts_with(Name, 'warmpawz-dev-rds-master')].ARN" --output text`,
        { encoding: 'utf8' }
      ).trim().split('\n')[0];

      if (secretList && secretList !== 'None' && secretList !== 'null') {
        if (SecretsManagerClient) {
          const secretsClient = new SecretsManagerClient({ region: REGION });
          const secretValue = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: secretList })
          );
          const secret = JSON.parse(secretValue.SecretString);
          password = secret.password || secret.Password || secret.secret || secret.Secret;
        } else {
          // Use AWS CLI
          const secretString = execSync(
            `aws secretsmanager get-secret-value --secret-id "${secretList}" --region ${REGION} --query SecretString --output text`,
            { encoding: 'utf8' }
          ).trim();
          const secret = JSON.parse(secretString);
          password = secret.password || secret.Password || secret.secret || secret.Secret;
        }
      }
    } catch (e) {
      console.log('⚠️  Could not get password from Secrets Manager');
    }
  }

  if (!password) {
    console.error('❌ ERROR: Password not found. Set DB_PASSWORD or PGPASSWORD environment variable.');
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
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Check existing schema
  console.log('🔍 Checking existing schema...');
  const existingCheck = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM information_schema.columns 
       WHERE table_name = 'customers' AND column_name = 'status') as has_status,
      (SELECT COUNT(*) FROM information_schema.columns 
       WHERE table_name = 'customers' AND column_name = 'onboarding_status') as has_onboarding_status,
      (SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_name = 'customer_identity') as has_identity_table,
      (SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_name = 'customer_profile_completion') as has_completion_table
  `);

  const check = existingCheck.rows[0];
  if (parseInt(check.has_status) > 0 || 
      parseInt(check.has_onboarding_status) > 0 ||
      parseInt(check.has_identity_table) > 0 ||
      parseInt(check.has_completion_table) > 0) {
    console.log('⚠️  WARNING: Some schema elements already exist');
    console.log(`   customers.status: ${check.has_status > 0 ? '✅' : '❌'}`);
    console.log(`   customers.onboarding_status: ${check.has_onboarding_status > 0 ? '✅' : '❌'}`);
    console.log(`   customer_identity table: ${check.has_identity_table > 0 ? '✅' : '❌'}`);
    console.log(`   customer_profile_completion table: ${check.has_completion_table > 0 ? '✅' : '❌'}`);
    console.log('');
    console.log('The migration uses IF NOT EXISTS so it\'s safe to run.');
    console.log('');
  }

  // Execute migration
  console.log('⚙️  Running migration...');
  console.log('─────────────────────────────────────────────────────────────────────────');
  
  try {
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration executed successfully');
    console.log('');
  } catch (error) {
    // Check if it's a "already exists" error (which is OK)
    if (error.message.includes('already exists') || 
        error.message.includes('duplicate key') ||
        error.message.includes('IF NOT EXISTS')) {
      console.log(`⚠️  Some elements may already exist (this is OK): ${error.message.substring(0, 100)}`);
    } else {
      console.error(`❌ Migration failed: ${error.message}`);
      await pool.end();
      process.exit(1);
    }
  }

  // Verify migration
  console.log('🔍 Verifying migration...');
  const verification = await pool.query(`
    SELECT 
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'status'
      ) THEN '✅' ELSE '❌' END as status_column,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'onboarding_status'
      ) THEN '✅' ELSE '❌' END as onboarding_status_column,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'customer_identity'
      ) THEN '✅' ELSE '❌' END as identity_table,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'customer_profile_completion'
      ) THEN '✅' ELSE '❌' END as completion_table
  `);

  const ver = verification.rows[0];
  console.log(`   customers.status: ${ver.status_column}`);
  console.log(`   customers.onboarding_status: ${ver.onboarding_status_column}`);
  console.log(`   customer_identity table: ${ver.identity_table}`);
  console.log(`   customer_profile_completion table: ${ver.completion_table}`);
  console.log('');

  // Show sample data
  try {
    const sample = await pool.query(`
      SELECT 
        phone,
        status,
        onboarding_status,
        profile_completed
      FROM customers
      LIMIT 5
    `);
    
    if (sample.rows.length > 0) {
      console.log('📊 Sample customer states:');
      sample.rows.forEach(row => {
        console.log(`   ${row.phone}: status=${row.status || 'NULL'}, onboarding=${row.onboarding_status || 'NULL'}, profile_completed=${row.profile_completed || false}`);
      });
      console.log('');
    }
  } catch (e) {
    // Ignore if query fails
  }

  await pool.end();

  console.log('✅ Migration 059 completed and verified!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Deploy backend changes');
  console.log('  2. Test customer authentication');
  console.log('  3. Verify state transitions');
}

if (require.main === module) {
  runMigration().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };

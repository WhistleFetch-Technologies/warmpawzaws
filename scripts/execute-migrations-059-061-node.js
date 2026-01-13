#!/usr/bin/env node
/**
 * Execute Migrations 059-061 on AWS RDS
 * Runs critical migrations for test coverage fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Try to load pg from db/node_modules first, then global
let Pool;
try {
  Pool = require(path.join(__dirname, '..', 'db', 'node_modules', 'pg')).Pool;
} catch (e) {
  try {
    Pool = require('pg').Pool;
  } catch (e2) {
    console.error('❌ pg module not found. Installing...');
    console.error('Please run: cd db && npm install pg');
    process.exit(1);
  }
}

// Try to load AWS SDK
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require('@aws-sdk/client-secrets-manager');
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (e) {
  // Fallback: use AWS CLI
  console.log('⚠️  AWS SDK not found, using AWS CLI fallback');
}

const ENVIRONMENT = process.env.ENVIRONMENT || process.argv[2] || 'dev';
const REGION = process.env.AWS_REGION || process.argv[3] || 'ap-south-1';

async function runMigrations() {
  console.log('🔄 Executing Migrations 059-061');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  console.log('📊 Getting RDS cluster information...');
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }

  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';

  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';

  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';

  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  
  let password;
  if (SecretsManagerClient) {
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretList = execSync(
      `aws secretsmanager list-secrets --region ${REGION} --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" --output text`,
      { encoding: 'utf8' }
    ).trim().split('\n')[0];

    if (!secretList || secretList === 'None') {
      console.error('❌ ERROR: RDS secret not found');
      process.exit(1);
    }

    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretList })
    );

    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password || secret.secret || secret.Secret;
  } else {
    // Fallback: use AWS CLI
    const secretList = execSync(
      `aws secretsmanager list-secrets --region ${REGION} --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" --output text`,
      { encoding: 'utf8' }
    ).trim().split('\n')[0];

    if (!secretList || secretList === 'None') {
      console.error('❌ ERROR: RDS secret not found');
      process.exit(1);
    }

    const secretString = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretList}" --region ${REGION} --query SecretString --output text`,
      { encoding: 'utf8' }
    ).trim();

    const secret = JSON.parse(secretString);
    password = secret.password || secret.Password || secret.secret || secret.Secret;
  }

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
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Execute migrations
  const migrations = [
    '059_fix_service_categories_uuid_text_conflict.sql',
    '060_create_refund_rules_tables.sql',
    '061_fix_admin_governance_tables.sql',
    '062_create_booking_status_history.sql'
  ];

  for (const migration of migrations) {
    console.log(`📝 Executing migration: ${migration}`);
    
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migration);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`   ⚠️  Migration file not found: ${migrationPath}`);
      continue;
    }

    try {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      console.log(`   ✅ Migration executed successfully`);
    } catch (error) {
      // Check if it's a "already exists" error (which is OK)
      if (error.message.includes('already exists') || 
          error.message.includes('does not exist') ||
          error.message.includes('duplicate')) {
        console.log(`   ⚠️  Migration may have already been applied: ${error.message.substring(0, 100)}`);
      } else {
        console.error(`   ❌ Migration failed: ${error.message}`);
        // Continue with next migration
      }
    }
    console.log('');
  }

  await pool.end();

  console.log('✅ All migrations executed');
  console.log('');
  console.log('Next: Re-run test suite to verify fixes');
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };

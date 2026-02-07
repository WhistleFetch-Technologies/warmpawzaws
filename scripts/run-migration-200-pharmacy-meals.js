#!/usr/bin/env node
/**
 * Run Pharmacy & Meal Delivery Migration on AWS RDS
 * Migration 200: Complete schema for pharmacy orders, meal plans, subscriptions, delivery tracking
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Pharmacy & Meal Delivery Migration (200)');
  console.log('============================================');
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
    console.error('❌ Failed to get RDS cluster info:', error.message);
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
  let password;
  
  try {
    const secretsClient = new SecretsManagerClient({ region: REGION });
    // Try multiple secret name patterns
    const secretPatterns = [
      `warmpawz-${ENVIRONMENT}-rds-master`,
      `warmpawz-${ENVIRONMENT}-db-credentials`,
      `warmpawz/${ENVIRONMENT}/rds`,
    ];
    
    // First, find the correct secret name
    const { execSync } = require('child_process');
    let secretName;
    try {
      const secretsList = execSync(
        `aws secretsmanager list-secrets --region ${REGION} --query "SecretList[*].Name" --output text`,
        { encoding: 'utf8' }
      );
      const secretNames = secretsList.split(/\s+/);
      secretName = secretNames.find(s => s.includes('rds') && s.includes(ENVIRONMENT)) || secretPatterns[0];
      console.log(`   Found secret: ${secretName}`);
    } catch (e) {
      secretName = secretPatterns[0];
    }
    
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    
    const secret = JSON.parse(response.SecretString);
    password = secret.password;
    console.log('✅ Credentials retrieved from Secrets Manager');
  } catch (error) {
    console.error('❌ Failed to get credentials from Secrets Manager:', error.message);
    console.log('Trying environment variable...');
    
    password = process.env.DB_PASSWORD;
    if (!password) {
      console.error('❌ DB_PASSWORD environment variable not set');
      process.exit(1);
    }
  }
  console.log('');

  // Create connection pool
  console.log('🔗 Connecting to database...');
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '200_pharmacy_meal_delivery_complete.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)`);
    console.log('');

    // Run migration
    console.log('⚡ Running migration...');
    console.log('----------------------------------------');
    
    await client.query(migrationSQL);
    
    console.log('----------------------------------------');
    console.log('✅ Migration completed successfully!');
    console.log('');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = [
      'logistics_rules',
      'pharmacy_orders',
      'pharmacy_broadcasts',
      'meal_plans',
      'meal_subscriptions',
      'meal_orders',
      'delivery_tracking',
      'delivery_location_history',
      'vendor_bank_accounts',
      'delivery_settlements',
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`,
        [table]
      );
      const exists = parseInt(result.rows[0].count) > 0;
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }

    client.release();
    console.log('');
    console.log('🎉 Migration 200 completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);

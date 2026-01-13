#!/usr/bin/env node
/**
 * ============================================================================
 * Check Tables and Run Migration 057
 * ============================================================================
 * Checks existing tables before running migration to avoid conflicts
 * ============================================================================
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const RDS_ENDPOINT = 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME = 'warmpawz';
const RDS_SECRET_ARN = 'warmpawz-dev-rds-master-20260106164510791100000002';
const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '057_vendor_capabilities_tables.sql');

const TABLES_TO_CHECK = [
  'prescriptions', 'medical_records', 'diagnostic_tests',
  'service_packages', 'package_sessions', 'gps_tracking_sessions',
  'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
  'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
];

async function getDbCredentials() {
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const command = new GetSecretValueCommand({ SecretId: RDS_SECRET_ARN });
  
  try {
    const response = await secretsClient.send(command);
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    const secret = JSON.parse(response.SecretString);
    return {
      username: secret.username || secret.Username || 'warmpawz_admin',
      password: secret.password || secret.Password
    };
  } catch (error) {
    console.error('❌ Error fetching credentials:', error.message);
    throw error;
  }
}

async function checkExistingTables(pool) {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = ANY($1)
    ORDER BY table_name;
  `;
  
  const result = await pool.query(query, [TABLES_TO_CHECK]);
  return result.rows.map(row => row.table_name);
}

async function runMigration(pool) {
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
  
  console.log('🚀 Running migration...');
  await pool.query(migrationSQL);
  console.log('✅ Migration executed successfully');
}

async function verifyTables(pool) {
  const existing = await checkExistingTables(pool);
  console.log('\n📊 Tables after migration:');
  TABLES_TO_CHECK.forEach(table => {
    const exists = existing.includes(table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  });
}

async function main() {
  console.log('============================================================================');
  console.log('Migration 057: Vendor Capabilities Tables');
  console.log('============================================================================\n');
  
  try {
    // Get credentials
    console.log('🔐 Getting RDS credentials from Secrets Manager...');
    const credentials = await getDbCredentials();
    console.log('✅ Credentials retrieved');
    console.log(`   Username: ${credentials.username}`);
    console.log(`   Endpoint: ${RDS_ENDPOINT}`);
    console.log(`   Database: ${DB_NAME}\n`);
    
    // Create connection pool
    const pool = new Pool({
      host: RDS_ENDPOINT,
      port: 5432,
      database: DB_NAME,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false },
      max: 1
    });
    
    // Check existing tables
    console.log('🔍 Checking existing tables...');
    const existingTables = await checkExistingTables(pool);
    
    if (existingTables.length > 0) {
      console.log(`⚠️  WARNING: ${existingTables.length} tables already exist:`);
      existingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('\n   The migration uses "CREATE TABLE IF NOT EXISTS" so it\'s safe to run.\n');
    } else {
      console.log('✅ No existing tables found. Safe to proceed.\n');
    }
    
    // Confirm
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Do you want to proceed with the migration? (yes/no): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Migration cancelled');
      await pool.end();
      process.exit(0);
    }
    
    // Run migration
    await runMigration(pool);
    
    // Verify
    await verifyTables(pool);
    
    console.log('\n✅ Migration 057 complete!');
    
    await pool.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

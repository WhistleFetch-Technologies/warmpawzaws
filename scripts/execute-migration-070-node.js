#!/usr/bin/env node
/**
 * Execute Migration 070: Package Tracking Enhancements
 * Uses Node.js pg library to execute SQL migration
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'ap-south-1';

async function getRdsEndpoint() {
  try {
    // Try cluster first
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    const clusterOutput = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (clusterOutput && clusterOutput !== 'None' && clusterOutput !== 'null') {
      return clusterOutput;
    }
    
    // Try instance
    const instanceId = `warmpawz-${ENVIRONMENT}-db`;
    const instanceOutput = execSync(
      `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Address' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (instanceOutput && instanceOutput !== 'None') {
      return instanceOutput;
    }
    
    throw new Error('RDS endpoint not found');
  } catch (error) {
    throw new Error(`Failed to get RDS endpoint: ${error.message}`);
  }
}

async function getDbCredentials() {
  try {
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master`;
    const secretsOutput = execSync(
      `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, '${secretName}')].ARN" --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secretArn = secretsOutput.split('\n')[0];
    if (!secretArn || secretArn === 'None') {
      throw new Error('RDS secret not found');
    }
    
    const secretValue = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretArn}" --region "${REGION}" --query SecretString --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secret = JSON.parse(secretValue);
    return {
      username: secret.username || secret.Username,
      password: secret.password || secret.Password,
      database: secret.dbname || secret.dbname || `warmpawz_${ENVIRONMENT}`
    };
  } catch (error) {
    throw new Error(`Failed to get DB credentials: ${error.message}`);
  }
}

async function executeMigration() {
  console.log('🔄 Executing Migration 070: Package Tracking Enhancements');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');
  
  try {
    // Get RDS endpoint
    console.log('📊 Getting database connection from AWS...');
    const endpoint = await getRdsEndpoint();
    console.log(`✅ RDS Endpoint: ${endpoint}`);
    
    // Get credentials
    const credentials = await getDbCredentials();
    console.log(`✅ Database: ${credentials.database}`);
    console.log(`✅ User: ${credentials.username}`);
    console.log('');
    
    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '070_package_tracking_enhancements.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`📄 Migration file: ${migrationFile}`);
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = new Client({
      host: endpoint,
      port: 5432,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');
    
    // Check if package_purchases table exists, if not create it first
    console.log('🔍 Checking if package_purchases table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'package_purchases'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  package_purchases table does not exist. Creating it first...');
      console.log('⚠️  Migration 013 file not found, creating table manually...');
      // Create table manually (without foreign key to package_sessions which may not exist)
      await client.query(`
        CREATE TABLE IF NOT EXISTS package_purchases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          purchase_id TEXT NOT NULL UNIQUE,
          package_id UUID NOT NULL,
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
          package_name TEXT NOT NULL,
          package_type TEXT NOT NULL CHECK (package_type IN ('bundle', 'time_based', 'appointment', 'membership', 'subscription')),
          package_price NUMERIC(10, 2) NOT NULL,
          purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          total_sessions INTEGER DEFAULT 0,
          remaining_sessions INTEGER DEFAULT 0,
          unlimited_usage BOOLEAN DEFAULT false,
          amount NUMERIC(10, 2) NOT NULL,
          payment_method TEXT,
          payment_id UUID,
          payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'used_up')),
          is_recurring BOOLEAN DEFAULT false,
          next_billing_date TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_package_purchases_customer ON package_purchases(customer_id);
        CREATE INDEX IF NOT EXISTS idx_package_purchases_package ON package_purchases(package_id);
        CREATE INDEX IF NOT EXISTS idx_package_purchases_vendor ON package_purchases(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_package_purchases_status ON package_purchases(status);
        CREATE INDEX IF NOT EXISTS idx_package_purchases_purchase_id ON package_purchases(purchase_id);
      `);
      console.log('✅ package_purchases table created');
      console.log('');
    } else {
      console.log('✅ package_purchases table exists');
      console.log('');
    }
    
    // Execute migration
    console.log('🚀 Executing migration 070...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!');
    console.log('');
    
    // Verify tables
    console.log('📊 Verifying tables created...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'package_purchases', 
        'package_scheduled_sessions',
        'walk_routes', 
        'walker_live_sessions',
        'training_skills', 
        'pet_skill_progress'
      ) 
      ORDER BY table_name;
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Tables created:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  No expected tables found (they may have existed already)');
    }
    
    await client.end();
    console.log('');
    console.log('✅ Migration complete!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

executeMigration();

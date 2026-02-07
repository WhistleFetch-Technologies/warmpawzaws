#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 255: Add Tax Fields to Package Purchases
 * ============================================================================
 * 
 * Purpose: Add tax calculation fields (tax_rate, tax_amount, total_with_tax, settlement_id)
 *          to package_purchases table
 * 
 * Usage:
 *   node scripts/apply-migration-255-tax-fields-package-purchases.js
 * 
 * Environment Variables:
 *   - DB_HOST: RDS database host
 *   - DB_NAME: Database name
 *   - DB_SECRET_ARN: ARN of the secret containing DB credentials (optional if DB_USER/DB_PASSWORD are set)
 *   - DB_USER: Database username (optional if DB_SECRET_ARN is provided)
 *   - DB_PASSWORD: Database password (optional if DB_SECRET_ARN is provided)
 *   - AWS_REGION: AWS region (defaults to ap-south-1)
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

// Allow override via environment variables, but try to auto-discover from RDS
let DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
let DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
let DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
let DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;
let DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

// ============================================================================
// SECRETS MANAGER CLIENT
// ============================================================================

const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

/**
 * Fetch database credentials from AWS Secrets Manager
 */
async function fetchDbCredentials() {
  if (DB_USER && DB_PASSWORD) {
    console.log('✅ Using credentials from environment variables');
    return;
  }

  // Try to find the secret automatically if not provided
  let secretName = DB_SECRET_ARN;
  if (!secretName) {
    secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  }

  try {
    console.log(`📥 Fetching credentials from Secrets Manager: ${secretName}`);
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    DB_USER = DB_USER || secret.username || secret.Username || secret.user;
    DB_PASSWORD = secret.password || secret.Password;

    if (!DB_PASSWORD) {
      throw new Error('Failed to parse password from secret');
    }
    if (!DB_USER) {
      throw new Error('Failed to parse username from secret');
    }

    console.log('✅ Successfully fetched credentials from Secrets Manager');
  } catch (error) {
    if (!DB_USER || !DB_PASSWORD) {
      console.error('❌ Failed to fetch credentials from Secrets Manager:', error.message);
      console.error('   Please ensure DB_USER and DB_PASSWORD are set, or DB_SECRET_ARN is correct');
      throw error;
    } else {
      console.log('⚠️  Could not fetch from Secrets Manager, using provided credentials');
    }
  }
}

// ============================================================================
// MIGRATION SQL
// ============================================================================

// Read migration SQL from file
const migrationPath = path.join(__dirname, '../db/migrations/255_add_tax_fields_to_package_purchases.sql');
let MIGRATION_SQL = '';

if (fs.existsSync(migrationPath)) {
  MIGRATION_SQL = fs.readFileSync(migrationPath, 'utf-8');
} else {
  // Fallback: inline SQL
  MIGRATION_SQL = `
BEGIN;

-- Add tax fields to package_purchases table
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    tax_rate DECIMAL(5, 2) DEFAULT 18.00;

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    tax_amount NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    total_with_tax NUMERIC(10, 2);

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    settlement_id UUID REFERENCES settlements(id);

-- Update existing records to calculate tax if amount exists
UPDATE package_purchases
SET 
    tax_rate = 18.00,
    tax_amount = ROUND((amount * 18.00) / 100, 2),
    total_with_tax = amount + ROUND((amount * 18.00) / 100, 2)
WHERE (tax_amount IS NULL OR tax_amount = 0)
AND amount > 0;

-- Add index for settlement lookup
CREATE INDEX IF NOT EXISTS idx_package_purchases_settlement 
ON package_purchases(settlement_id) 
WHERE settlement_id IS NOT NULL;

COMMENT ON COLUMN package_purchases.tax_rate IS 'GST rate applied (default 18% for India)';
COMMENT ON COLUMN package_purchases.tax_amount IS 'Tax amount calculated on package price';
COMMENT ON COLUMN package_purchases.total_with_tax IS 'Total amount including tax';
COMMENT ON COLUMN package_purchases.settlement_id IS 'Reference to settlement record when package purchase is settled';

COMMIT;
`;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function applyMigration() {
  console.log('='.repeat(70));
  console.log('🚀 APPLYING MIGRATION 255: Add Tax Fields to Package Purchases');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('');

  // Try to auto-discover RDS cluster info if not provided
  if (!DB_HOST || !DB_NAME) {
    console.log('📊 Auto-discovering RDS cluster information...');
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

      const endpoint = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      ).trim();

      if (endpoint && endpoint !== 'None' && endpoint !== 'null' && endpoint.length > 0) {
        DB_HOST = endpoint;
        DB_PORT = parseInt(execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || '5432', 10);
        DB_NAME = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz';
        DB_USER = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz_admin';
        console.log('✅ RDS Cluster found via AWS CLI');
      }
    } catch (error) {
      console.log('⚠️  Could not auto-discover RDS cluster (this is OK if using environment variables)');
    }
  }

  // Validate environment variables
  if (!DB_HOST || !DB_NAME) {
    console.error('❌ Missing required database connection information:');
    console.error('   - DB_HOST:', DB_HOST ? '✅' : '❌');
    console.error('   - DB_NAME:', DB_NAME ? '✅' : '❌');
    console.error('');
    console.error('Please set one of the following:');
    console.error('  1. Environment variables: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
    console.error('  2. Or ensure AWS CLI is configured and RDS cluster exists');
    console.error('  3. Or set DB_SECRET_ARN to fetch credentials from Secrets Manager');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Host: ${DB_HOST}`);
  console.log(`   Port: ${DB_PORT}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   User: ${DB_USER || '(will fetch from secret)'}`);
  console.log(`   Region: ${AWS_REGION}`);
  console.log('');

  // Fetch credentials
  try {
    await fetchDbCredentials();
  } catch (error) {
    console.error('❌ Failed to get database credentials:', error.message);
    process.exit(1);
  }

  // Create connection pool
  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 1, // Only need one connection for migration
    });

    // Test connection
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');
    console.log('');

    // Check current state
    console.log('🔍 Checking current state of package_purchases table...');
    const checkResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'package_purchases'
      AND column_name IN ('tax_rate', 'tax_amount', 'total_with_tax', 'settlement_id')
      ORDER BY column_name
    `);

    const existingColumns = checkResult.rows.map(r => r.column_name);
    if (existingColumns.length > 0) {
      console.log(`ℹ️  Found ${existingColumns.length} existing tax columns: ${existingColumns.join(', ')}`);
      if (existingColumns.length >= 4) {
        console.log('✅ All tax columns already exist. Migration already applied.');
        await pool.end();
        process.exit(0);
      }
    } else {
      console.log('ℹ️  No tax columns found. Will add them now.');
    }
    console.log('');

    // Apply migration
    console.log('📝 Applying migration...');
    const result = await pool.query(MIGRATION_SQL);
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'package_purchases'
      AND column_name IN ('tax_rate', 'tax_amount', 'total_with_tax', 'settlement_id')
      ORDER BY column_name
    `);

    if (verifyResult.rows.length >= 4) {
      console.log('');
      console.log('='.repeat(70));
      console.log('✅ MIGRATION 255 APPLIED SUCCESSFULLY!');
      console.log('='.repeat(70));
      console.log('');
      console.log('📊 Column Details:');
      verifyResult.rows.forEach(row => {
        console.log(`   ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      console.log('');
      
      // Check index
      const indexResult = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'package_purchases'
        AND indexname = 'idx_package_purchases_settlement'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('✅ Index created: idx_package_purchases_settlement');
      }
      console.log('');
    } else {
      console.error(`❌ Migration verification failed: Expected 4 columns, found ${verifyResult.rows.length}`);
      await pool.end();
      process.exit(1);
    }

    await pool.end();
    console.log('✅ Database connection closed');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('='.repeat(70));
    console.error('❌ MIGRATION FAILED');
    console.error('='.repeat(70));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.error('');
    
    if (pool) {
      await pool.end();
    }
    process.exit(1);
  }
}

// Run migration
applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

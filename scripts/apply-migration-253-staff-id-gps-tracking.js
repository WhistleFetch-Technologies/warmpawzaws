#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 253: ADD staff_id COLUMN TO gps_tracking_sessions
 * ============================================================================
 * 
 * This script applies migration 253 to add the staff_id column to the
 * gps_tracking_sessions table if it doesn't already exist.
 * 
 * Usage:
 *   node scripts/apply-migration-253-staff-id-gps-tracking.js
 * 
 * Environment Variables Required:
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

const MIGRATION_SQL = `
-- ============================================================================
-- MIGRATION 253: ADD staff_id COLUMN TO gps_tracking_sessions
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Add staff_id column to gps_tracking_sessions table if it doesn't exist
-- This column is needed for tracking sessions where a staff member (not vendor) 
-- is performing the service
-- ============================================================================

BEGIN;

-- Check if column exists, and add it if it doesn't
DO $$
BEGIN
    -- Check if staff_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' 
        AND column_name = 'staff_id'
    ) THEN
        -- Add staff_id column
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN staff_id UUID REFERENCES staff(id);
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_staff_id 
        ON gps_tracking_sessions(staff_id);
        
        RAISE NOTICE '✅ Added staff_id column to gps_tracking_sessions table';
    ELSE
        RAISE NOTICE 'ℹ️  staff_id column already exists in gps_tracking_sessions table';
    END IF;
END $$;

COMMIT;
`;

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function applyMigration() {
  console.log('='.repeat(70));
  console.log('🚀 APPLYING MIGRATION 253: Add staff_id to gps_tracking_sessions');
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
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text`,
        { encoding: 'utf8' }
      ).trim();

      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        DB_HOST = endpoint;
        DB_PORT = parseInt(execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text`,
          { encoding: 'utf8' }
        ).trim() || '5432', 10);
        DB_NAME = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text`,
          { encoding: 'utf8' }
        ).trim() || 'warmpawz';
        DB_USER = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text`,
          { encoding: 'utf8' }
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
    console.log('🔍 Checking current state of gps_tracking_sessions table...');
    const checkResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gps_tracking_sessions'
      AND column_name = 'staff_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('ℹ️  staff_id column already exists:');
      console.log(`   Type: ${checkResult.rows[0].data_type}`);
      console.log(`   Nullable: ${checkResult.rows[0].is_nullable}`);
      console.log('');
      console.log('✅ Migration already applied. No action needed.');
      await pool.end();
      process.exit(0);
    } else {
      console.log('ℹ️  staff_id column does not exist. Will add it now.');
      console.log('');
    }

    // Apply migration
    console.log('📝 Applying migration...');
    const result = await pool.query(MIGRATION_SQL);
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gps_tracking_sessions'
      AND column_name = 'staff_id'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('');
      console.log('='.repeat(70));
      console.log('✅ MIGRATION 253 APPLIED SUCCESSFULLY!');
      console.log('='.repeat(70));
      console.log('');
      console.log('📊 Column Details:');
      console.log(`   Name: ${verifyResult.rows[0].column_name}`);
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
      console.log(`   Nullable: ${verifyResult.rows[0].is_nullable}`);
      console.log('');
      
      // Check index
      const indexResult = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'gps_tracking_sessions'
        AND indexname = 'idx_gps_tracking_sessions_staff_id'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('✅ Index created: idx_gps_tracking_sessions_staff_id');
      } else {
        console.log('⚠️  Index not found (may have been created with IF NOT EXISTS)');
      }
      console.log('');
    } else {
      console.error('❌ Migration verification failed: staff_id column not found after migration');
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

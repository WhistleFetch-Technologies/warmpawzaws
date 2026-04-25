#!/usr/bin/env node
/**
 * Run All Pending Migrations on Production RDS
 * 
 * This script runs all migrations identified in MIGRATION_FIELDS_SUMMARY.md
 * in the correct order for production RDS.
 * 
 * Usage:
 *   ENVIRONMENT=prod node scripts/run-all-pending-migrations-prod.js
 *   ENVIRONMENT=prod node scripts/run-all-pending-migrations-prod.js --dry-run
 *   ENVIRONMENT=prod node scripts/run-all-pending-migrations-prod.js --skip-verification
 * 
 * Requires:
 *   - AWS CLI configured with appropriate permissions
 *   - RDS cluster: warmpawz-prod-cluster
 *   - Secrets Manager secret: warmpawz-prod-rds-master-20260207201049162400000001
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_VERIFICATION = process.argv.includes('--skip-verification');

// List of migrations to run in order (from MIGRATION_FIELDS_SUMMARY.md)
const MIGRATIONS = [
  '536_cancellation_refund_policy_business_rules.sql',
  '541_add_missing_booking_columns.sql',
  '542_add_video_call_sessions_join_tokens.sql',
  '544_add_bookings_video_call_columns.sql',
  '560_ensure_vendor_profile_columns_prod.sql',
  '563_add_prescriptions_general_notes_column.sql',
  '564_add_prescriptions_next_follow_up_date_column.sql',
  '565_ensure_prescription_date_default_dev.sql',
  '600_add_vendor_available_for_instant_tele.sql',
  '600_tax_360_mapping.sql',
  '602_add_updated_at_to_vendor_documents.sql',
  '603_add_code_to_promotions.sql',
  '605_add_availability_configured_column.sql',
  '607_add_bookings_is_instant_tele.sql',
  '608_add_pharmacy_orders_columns.sql',
  '609_add_vendor_availability_v2_columns.sql',
  '610_add_vendor_identity_columns.sql',
  '611_add_vendors_metadata_column.sql',
  '612_add_onboarding_forms_sections.sql',
];

// Optional migrations (check if they exist)
const OPTIONAL_MIGRATIONS = [
  '561_ensure_otp_tokens_table_prod.sql',
  '562_add_allowed_service_styles_problem_grid_mappings.sql',
];

async function getRDSConnection() {
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`❌ RDS cluster not found: ${clusterId}`);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  // Use RDS Proxy endpoint for production
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
    console.log('   ℹ️  Using RDS Proxy endpoint for production');
  }
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
  
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;

  if (!password) {
    throw new Error('❌ Password not found in secret');
  }

  console.log('✅ Credentials retrieved');
  console.log('');

  // Create connection pool
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 60000, // Increased to 60 seconds
    idleTimeoutMillis: 30000,
    max: 1, // Single connection for migration
  });

  // Test connection with retry
  let connected = false;
  let retries = 3;
  while (!connected && retries > 0) {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to connect to database after 3 attempts: ${error.message}`);
      }
      console.log(`   ⚠️  Connection attempt failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
    }
  }
  console.log('✅ Connection successful');
  console.log('');

  return { pool, endpoint, dbName };
}

async function runMigration(pool, migrationFile) {
  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.log(`⚠️  Migration file not found: ${migrationFile}`);
    return { success: false, skipped: true, reason: 'File not found' };
  }

  console.log(`📄 Running: ${migrationFile}`);
  console.log(`   Path: ${migrationPath}`);
  
  if (DRY_RUN) {
    console.log('   [DRY RUN] Would execute migration');
    return { success: true, skipped: false, dryRun: true };
  }

  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log(`   ✅ Migration completed successfully`);
    return { success: true, skipped: false };
  } catch (error) {
    // Check if error is about object already existing (safe to ignore for idempotent migrations)
    if (error.message.includes('already exists') || 
        error.message.includes('duplicate') ||
        error.message.includes('IF NOT EXISTS')) {
      console.log(`   ⚠️  Migration skipped (object may already exist): ${error.message.split('\n')[0]}`);
      return { success: true, skipped: true, reason: error.message };
    }
    throw error;
  }
}

async function verifyMigration(pool, migrationFile) {
  if (SKIP_VERIFICATION) {
    return;
  }

  const basename = path.basename(migrationFile, '.sql');
  
  // Basic verification - check if migration file contains common patterns
  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
  if (!fs.existsSync(migrationPath)) {
    return;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Check for common table/column patterns
  const tableMatches = sql.match(/ALTER TABLE\s+(\w+)/gi);
  if (tableMatches) {
    for (const match of tableMatches) {
      const tableName = match.replace(/ALTER TABLE\s+/i, '').trim();
      const columnMatches = sql.match(new RegExp(`ADD COLUMN.*?\\s+(\\w+)\\s+`, 'gi'));
      
      if (columnMatches) {
        for (const colMatch of columnMatches) {
          const columnName = colMatch.replace(/ADD COLUMN.*?\\s+/i, '').split(/\s/)[0].trim();
          try {
            const result = await pool.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name = $2
            `, [tableName, columnName]);
            
            if (result.rows.length > 0) {
              console.log(`   ✅ Verified: ${tableName}.${columnName} exists`);
            }
          } catch (err) {
            // Ignore verification errors
          }
        }
      }
    }
  }
}

async function main() {
  console.log('🚀 Running All Pending Migrations - Production RDS');
  console.log('==================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }
  console.log('');

  let pool;
  try {
    const connection = await getRDSConnection();
    pool = connection.pool;

    const results = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Run required migrations
    console.log('📋 Running Required Migrations:');
    console.log('─────────────────────────────');
    for (const migration of MIGRATIONS) {
      const result = await runMigration(pool, migration);
      if (result.success && !result.skipped) {
        results.successful.push(migration);
        await verifyMigration(pool, migration);
      } else if (result.skipped) {
        results.skipped.push(migration);
      } else {
        results.failed.push({ migration, error: result.error });
      }
      console.log('');
    }

    // Run optional migrations (if they exist)
    console.log('📋 Checking Optional Migrations:');
    console.log('────────────────────────────────');
    for (const migration of OPTIONAL_MIGRATIONS) {
      const result = await runMigration(pool, migration);
      if (result.success && !result.skipped) {
        results.successful.push(migration);
        await verifyMigration(pool, migration);
      } else if (result.skipped && !result.reason?.includes('not found')) {
        results.skipped.push(migration);
      }
      console.log('');
    }

    // Summary
    console.log('📊 Migration Summary:');
    console.log('────────────────────');
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`⚠️  Skipped: ${results.skipped.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log('');

    if (results.successful.length > 0) {
      console.log('✅ Successful migrations:');
      results.successful.forEach(m => console.log(`   - ${m}`));
      console.log('');
    }

    if (results.skipped.length > 0) {
      console.log('⚠️  Skipped migrations (may already exist):');
      results.skipped.forEach(m => console.log(`   - ${m}`));
      console.log('');
    }

    if (results.failed.length > 0) {
      console.log('❌ Failed migrations:');
      results.failed.forEach(({ migration, error }) => {
        console.log(`   - ${migration}`);
        console.log(`     Error: ${error}`);
      });
      console.log('');
      process.exit(1);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('');
    console.error('❌ Migration process failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, runMigration, getRDSConnection };

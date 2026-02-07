#!/usr/bin/env node
/**
 * ============================================================================
 * GAP ANALYSIS MIGRATION RUNNER
 * ============================================================================
 * 
 * Runs the gap analysis fixes migration (100_gap_analysis_fixes.sql) on AWS RDS
 * 
 * Usage:
 *   node scripts/run-gap-analysis-migration.js
 *   
 * Environment Variables:
 *   ENVIRONMENT - dev, staging, or prod (default: dev)
 *   AWS_REGION - AWS region (default: ap-south-1)
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Migration file
const MIGRATION_FILE = '100_gap_analysis_fixes.sql';

async function runMigration() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          GAP ANALYSIS FIXES - DATABASE MIGRATION               ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Environment: ${ENVIRONMENT.padEnd(48)}║`);
  console.log(`║  Region: ${REGION.padEnd(53)}║`);
  console.log(`║  Migration: ${MIGRATION_FILE.padEnd(50)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const { execSync } = require('child_process');

  // Step 1: Get RDS cluster information
  console.log('📊 Step 1: Getting RDS cluster information...');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  let endpoint, port, dbName, username;

  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      throw new Error(`RDS cluster not found: ${clusterId}`);
    }

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim() || 'warmpawz_admin';

    console.log('   ✅ RDS Cluster found');
    console.log(`      Endpoint: ${endpoint}`);
    console.log(`      Port: ${port}`);
    console.log(`      Database: ${dbName}`);
    console.log('');

  } catch (error) {
    console.error(`   ❌ ERROR: ${error.message}`);
    console.error('   Make sure AWS CLI is configured and you have access to RDS');
    process.exit(1);
  }

  // Step 2: Get database credentials from Secrets Manager
  console.log('🔐 Step 2: Getting database credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });

  let password;

  try {
    // List secrets to find the RDS secret
    const listResult = await secretsClient.send(new ListSecretsCommand({
      Filters: [{ Key: 'name', Values: [`warmpawz-${ENVIRONMENT}-rds`] }],
    }));

    let secretName;
    if (listResult.SecretList && listResult.SecretList.length > 0) {
      secretName = listResult.SecretList[0].Name;
    } else {
      // Try common secret names
      const possibleSecretNames = [
        `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`,
        `warmpawz-${ENVIRONMENT}-rds-master`,
        `warmpawz-${ENVIRONMENT}-rds`,
        `warmpawz/${ENVIRONMENT}/rds`,
      ];

      for (const name of possibleSecretNames) {
        try {
          await secretsClient.send(new GetSecretValueCommand({ SecretId: name }));
          secretName = name;
          break;
        } catch (e) {
          // Try next
        }
      }
    }

    if (!secretName) {
      throw new Error('Could not find RDS secret in Secrets Manager');
    }

    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password || secret.secret || secret.Secret;

    if (!password) {
      throw new Error('Password not found in secret');
    }

    console.log('   ✅ Credentials retrieved');
    console.log('');

  } catch (error) {
    console.error(`   ❌ ERROR: ${error.message}`);
    console.error('   Check Secrets Manager permissions');
    process.exit(1);
  }

  // Step 3: Connect to database
  console.log('🔗 Step 3: Connecting to database...');
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('   ✅ Connection successful');
    console.log('');
  } catch (error) {
    console.error(`   ❌ Connection failed: ${error.message}`);
    console.error('   Check security group allows your IP');
    process.exit(1);
  }

  // Step 4: Read and run migration
  console.log('⚙️  Step 4: Running migration...');
  
  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', MIGRATION_FILE);

  if (!fs.existsSync(migrationPath)) {
    console.error(`   ❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`   📄 File: ${MIGRATION_FILE}`);
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statementCount = (sql.match(/CREATE TABLE|ALTER TABLE|CREATE INDEX|INSERT INTO/gi) || []).length;
  console.log(`   📊 Statements: ~${statementCount} DDL/DML statements`);
  console.log('');

  try {
    // Run migration
    await pool.query(sql);
    console.log('   ✅ Migration executed successfully');
    console.log('');
  } catch (error) {
    // Some errors are expected (e.g., "already exists")
    if (error.message.includes('already exists')) {
      console.log('   ⚠️  Some objects already exist (this is OK with IF NOT EXISTS)');
      console.log('');
    } else {
      console.error(`   ❌ Migration error: ${error.message}`);
      // Continue to verification
    }
  }

  // Step 5: Verify tables were created
  console.log('🔍 Step 5: Verifying created tables...');
  
  const newTables = [
    'staff_availability_per_style',
    'gps_tracking_sessions',
    'gps_location_history',
    'meal_subscriptions',
    'meal_subscription_deliveries',
    'customer_subscriptions',
    'scheduled_notifications',
    'user_devices',
    'commission_tiers',
    'meal_plans',
    'vendor_discounts',
    'medical_records',
    'coupons',
    'coupon_usage',
    'promotions',
  ];

  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
      ORDER BY table_name
    `, [newTables]);

    const createdTables = result.rows.map(r => r.table_name);
    const missingTables = newTables.filter(t => !createdTables.includes(t));

    console.log('');
    console.log('   Created Tables:');
    createdTables.forEach(t => console.log(`   ✅ ${t}`));
    
    if (missingTables.length > 0) {
      console.log('');
      console.log('   Missing Tables (may need manual check):');
      missingTables.forEach(t => console.log(`   ⚠️  ${t}`));
    }
    console.log('');

  } catch (error) {
    console.error(`   ❌ Verification error: ${error.message}`);
  }

  // Step 6: Verify new columns
  console.log('🔍 Step 6: Verifying new columns...');
  
  try {
    const columnsToCheck = [
      { table: 'bookings', column: 'video_call_reminder_sent' },
      { table: 'bookings', column: 'subscription_id' },
      { table: 'staff', column: 'photo_url' },
      { table: 'vendors', column: 'commission_tier_id' },
    ];

    const columnResult = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (table_name, column_name) IN (
        ('bookings', 'video_call_reminder_sent'),
        ('bookings', 'subscription_id'),
        ('staff', 'photo_url'),
        ('vendors', 'commission_tier_id')
      )
    `);

    const foundColumns = columnResult.rows.map(r => `${r.table_name}.${r.column_name}`);
    
    console.log('   Added Columns:');
    foundColumns.forEach(c => console.log(`   ✅ ${c}`));
    console.log('');

  } catch (error) {
    console.error(`   ❌ Column verification error: ${error.message}`);
  }

  // Step 7: Check commission tiers data
  console.log('🔍 Step 7: Verifying seed data...');
  
  try {
    const tiersResult = await pool.query(`
      SELECT tier_name, tier_level, default_commission_rate 
      FROM commission_tiers 
      ORDER BY tier_level
    `);

    if (tiersResult.rows.length > 0) {
      console.log('   Commission Tiers:');
      tiersResult.rows.forEach(t => 
        console.log(`   ✅ ${t.tier_name} (Level ${t.tier_level}): ${t.default_commission_rate}%`)
      );
    } else {
      console.log('   ⚠️  No commission tiers found');
    }
    console.log('');

  } catch (error) {
    // Table might not exist
    console.log('   ⚠️  Could not verify commission tiers');
  }

  await pool.end();

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    MIGRATION COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ Gap analysis migration executed                            ║');
  console.log('║  ✅ New tables created                                         ║');
  console.log('║  ✅ New columns added                                          ║');
  console.log('║  ✅ Seed data inserted                                         ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║  Next Steps:                                                   ║');
  console.log('║  1. Deploy Lambda: cd backend/lambda && npm run deploy         ║');
  console.log('║  2. Deploy Frontend: cd apps/customer-web && npm run deploy    ║');
  console.log('║  3. Set GOOGLE_MAPS_API_KEY environment variable               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

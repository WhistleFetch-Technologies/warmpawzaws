#!/usr/bin/env node
/**
 * Run E-commerce Enhancements Migration on AWS RDS
 * Migrations: 210_ecommerce_enhancements.sql, 211_returns_management.sql
 * 
 * Features:
 * - Product reviews and ratings
 * - Product views for recommendations
 * - GST-compliant invoices
 * - Return/refund management
 * - Vendor logistics settings
 * 
 * Date: 2026-01-20
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Migration files to run
const MIGRATION_FILES = [
  '210_ecommerce_enhancements.sql',
  '211_returns_management.sql',
];

async function runMigration() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('🛒 E-COMMERCE ENHANCEMENTS MIGRATION');
  console.log('━'.repeat(60));
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
    console.error('❌ ERROR: Could not get RDS cluster info');
    console.error(error.message);
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
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;

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
      connectionTimeoutMillis: 30000,
      statement_timeout: 120000, // 2 minutes per statement
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Run each migration
    console.log('⚙️  Running e-commerce migrations...');
    console.log('─'.repeat(50));
    
    let successCount = 0;
    let errorCount = 0;

    for (const migrationFile of MIGRATION_FILES) {
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
      
      console.log(`\n📄 ${migrationFile}`);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`   ⚠️  File not found: ${migrationPath}`);
        errorCount++;
        continue;
      }
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log(`   ✅ Migration completed successfully`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key')) {
          console.log(`   ⏭️  Tables already exist (safe to ignore)`);
          successCount++;
        } else {
          console.log(`   ❌ Error: ${error.message.substring(0, 80)}...`);
          errorCount++;
        }
      }
    }

    console.log('');
    console.log('─'.repeat(50));

    // Verify new tables
    console.log('\n🔍 Verifying created tables...');
    
    const verifyTables = [
      'product_reviews',
      'review_helpful_votes',
      'product_views',
      'invoices',
      'order_status_history',
      'return_requests',
      'return_items',
      'wallet_transactions',
    ];

    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
      ORDER BY table_name
    `, [verifyTables]);

    console.log(`\n✅ Verified ${result.rows.length}/${verifyTables.length} tables:`);
    result.rows.forEach(row => console.log(`   📦 ${row.table_name}`));

    // Check for new columns
    console.log('\n🔍 Verifying schema enhancements...');
    
    const columnChecks = [
      { table: 'products', columns: ['rating', 'review_count', 'view_count', 'sales_count', 'brand', 'material'] },
      { table: 'vendors', columns: ['fulfillment_type', 'default_carrier', 'return_window_days'] },
      { table: 'orders', columns: ['has_return_request', 'return_status', 'refund_amount'] },
    ];

    for (const check of columnChecks) {
      const colResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = ANY($2)
      `, [check.table, check.columns]);
      
      console.log(`   📋 ${check.table}: ${colResult.rows.length}/${check.columns.length} columns verified`);
    }

    await pool.end();

    console.log('');
    console.log('━'.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('━'.repeat(60));
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📁 Total: ${MIGRATION_FILES.length}`);
    console.log('');
    
    if (errorCount === 0) {
      console.log('🎉 E-commerce enhancements migration complete!');
      console.log('');
      console.log('📝 New features enabled:');
      console.log('   • Product reviews & ratings');
      console.log('   • Product recommendations engine');
      console.log('   • GST tax invoice generation');
      console.log('   • Self-managed logistics tracking');
      console.log('   • Complete return/refund flow');
    } else {
      console.log('⚠️  Migration completed with some errors. Review the output above.');
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('');
      console.log('💡 Troubleshooting tips:');
      console.log('   1. Ensure your IP is whitelisted in the RDS security group');
      console.log('   2. Run: npm run scripts add-current-ip-to-rds-sg.sh');
      console.log('   3. Check if the RDS cluster is running');
    }
    
    process.exit(1);
  }
}

runMigration();

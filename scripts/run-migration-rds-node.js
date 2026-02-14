#!/usr/bin/env node
/**
 * Run DB migration on AWS RDS using Node.js
 * Connects to RDS cluster and runs the migration script from db/migrations/.
 * Verification is migration-specific (e.g. 524: service_catalog.specialization_ids column + index).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
 *   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 053_admin_endpoints_tables.sql
 *
 * Requires: AWS CLI configured; RDS cluster warmpawz-{ENVIRONMENT}-cluster; Secrets Manager secret.
 * See docs/IMPLEMENTATION_FLOW.md.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Admin Endpoints Migration - AWS RDS');
  console.log('========================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  // ✅ FIX: Use --output json and parse to avoid PowerShell escaping issues
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
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

  // Try to find the secret - check common patterns
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  // For prod, use the actual secret name
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  
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
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Read migration file
    console.log('⚙️  Running migration...');
    console.log('─────────────────────────');
    
    // Get migration file path from command line argument or default
    const migrationFile = process.argv[2] || '053_admin_endpoints_tables.sql';
    const migrationPath = migrationFile.startsWith('db/') 
      ? path.join(__dirname, '..', migrationFile)
      : path.join(__dirname, '..', 'db', 'migrations', migrationFile);
    
    console.log(`📄 Migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(sql);
    console.log('✅ Migration completed!');
    console.log('');

    // Verification: migration-specific (do not assume; verify what was applied)
    const migrationBasename = path.basename(migrationPath);
    const is524 = migrationBasename.includes('524') && (sql.includes('specialization_ids') && sql.includes('service_catalog'));
    const is553 = migrationBasename.includes('553') && sql.includes('package_snapshot');

    if (is553) {
      console.log('🔍 Verifying migration 553: package_purchases.package_snapshot...');
      const colRes = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'package_purchases' AND column_name = 'package_snapshot'
      `);
      if (colRes.rows.length === 0) {
        throw new Error('Verification failed: column package_purchases.package_snapshot not found');
      }
      console.log(`   ✅ Column: ${colRes.rows[0].column_name} (${colRes.rows[0].data_type})`);
      const idxRes = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'package_purchases' AND indexname = 'idx_package_purchases_customer_vendor_active'
      `);
      if (idxRes.rows.length === 0) {
        throw new Error('Verification failed: index idx_package_purchases_customer_vendor_active not found');
      }
      console.log(`   ✅ Index: ${idxRes.rows[0].indexname}`);
    } else if (is524) {
      console.log('🔍 Verifying migration 524: service_catalog.specialization_ids...');
      const colRes = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'service_catalog' AND column_name = 'specialization_ids'
      `);
      if (colRes.rows.length === 0) {
        throw new Error('Verification failed: column service_catalog.specialization_ids not found');
      }
      console.log(`   ✅ Column: ${colRes.rows[0].column_name} (${colRes.rows[0].data_type})`);

      const idxRes = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'service_catalog' AND indexname = 'idx_service_catalog_specialization_ids'
      `);
      if (idxRes.rows.length === 0) {
        throw new Error('Verification failed: index idx_service_catalog_specialization_ids not found');
      }
      console.log(`   ✅ Index: ${idxRes.rows[0].indexname}`);
    } else {
      console.log('🔍 Verifying created tables...');
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'support_tickets', 
          'chat_sessions', 
          'transactions', 
          'vendor_payment_rules', 
          'vendor_refund_tiers',
          'vendor_support_requests',
          'compliance_issues'
        )
        ORDER BY table_name
      `);

      if (result.rows.length > 0) {
        console.log('✅ Created tables:');
        result.rows.forEach(row => console.log(`   - ${row.table_name}`));
      } else {
        console.log('⚠️  No tables found (may already exist or migration had issues)');
      }
    }

    await pool.end();
    console.log('');
    console.log('🎉 Migration and verification complete!');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    process.exit(1);
  }
}

runMigration();

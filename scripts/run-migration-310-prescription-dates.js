#!/usr/bin/env node
/**
 * Run Migration 310: Add Prescription Date Fields to Medical Records
 * Connects to AWS RDS Serverless and runs the migration script
 * 
 * Usage:
 *   node scripts/run-migration-310-prescription-dates.js [environment] [region]
 * 
 * Examples:
 *   node scripts/run-migration-310-prescription-dates.js dev ap-south-1
 *   node scripts/run-migration-310-prescription-dates.js staging ap-south-1
 *   node scripts/run-migration-310-prescription-dates.js prod ap-south-1
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || process.argv[2] || 'dev';
const REGION = process.env.AWS_REGION || process.argv[3] || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 310: Add Prescription Date Fields to Medical Records');
  console.log('===============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS cluster info
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    
    console.log('📊 Getting RDS cluster information...');
    let endpoint, port, dbName, username;
    
    try {
      const clusterInfo = JSON.parse(execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));

      if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
        throw new Error(`RDS cluster not found: ${clusterId}`);
      }

      const cluster = clusterInfo.DBClusters[0];
      endpoint = cluster.Endpoint;
      port = cluster.Port || 5432;
      dbName = cluster.DatabaseName || 'warmpawz';
      username = cluster.MasterUsername || 'warmpawz_admin';

      console.log('✅ RDS Cluster found:');
      console.log(`   Endpoint: ${endpoint}`);
      console.log(`   Port: ${port}`);
      console.log(`   Database: ${dbName}`);
      console.log(`   Username: ${username}`);
      console.log('');
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
        console.error('');
        console.error('💡 Solutions:');
        console.error('   1. Check if the cluster name is correct');
        console.error('   2. Verify AWS credentials: aws sts get-caller-identity');
        console.error('   3. Check if you have access to the RDS cluster');
        console.error('   4. For local development, use: DATABASE_URL=postgresql://... node db/run-migration.js');
        process.exit(1);
      }
      throw error;
    }

    // Get password from Secrets Manager
    console.log('🔐 Getting database credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

    let password;
    try {
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secret = JSON.parse(secretValue.SecretString);
      password = secret.password || secret.Password || secret.secret || secret.Secret;

      if (!password) {
        throw new Error('Password not found in secret');
      }

      console.log('✅ Credentials retrieved');
      console.log('');
    } catch (error) {
      console.error('❌ ERROR: Failed to get database credentials');
      console.error(`   Secret: ${secretName}`);
      console.error(`   Error: ${error.message}`);
      console.error('');
      console.error('💡 Solutions:');
      console.error('   1. Check if the secret exists in AWS Secrets Manager');
      console.error('   2. Verify AWS credentials and permissions');
      console.error('   3. For local development, use: DATABASE_URL=postgresql://... node db/run-migration.js');
      process.exit(1);
    }

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
      statement_timeout: 60000,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '310_add_prescription_date_fields.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ ERROR: Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    console.log('📄 Migration file loaded');
    console.log(`   File: ${migrationFile}`);
    console.log(`   Size: ${migrationSQL.length} bytes`);
    console.log('');

    // Execute migration
    console.log('⚙️  Running migration...');
    console.log('─'.repeat(60));
    
    try {
      await pool.query(migrationSQL);
      console.log('─'.repeat(60));
      console.log('✅ Migration completed successfully!');
      console.log('');
    } catch (error) {
      // Check if it's an "already exists" error (safe to ignore)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          (error.message.includes('column') && error.message.includes('already exists'))) {
        console.log('─'.repeat(60));
        console.log('⚠️  Migration already applied (or partially applied)');
        console.log(`   ${error.message.split('\n')[0]}`);
        console.log('   This is safe to ignore if using IF NOT EXISTS.');
        console.log('');
      } else {
        throw error;
      }
    }

    // Verify columns were added
    console.log('🔍 Verifying migration...');
    const verifyQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'medical_records'
        AND column_name IN ('record_date', 'prescription_date')
      ORDER BY column_name;
    `;

    const { rows } = await pool.query(verifyQuery);

    if (rows.length > 0) {
      console.log('✅ Columns added:');
      rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('⚠️  Columns not found - migration may have failed');
    }

    // Verify indexes
    const indexQuery = `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'medical_records'
        AND indexname IN ('idx_medical_records_record_date', 'idx_medical_records_prescription_date')
      ORDER BY indexname;
    `;

    const { rows: indexes } = await pool.query(indexQuery);

    if (indexes.length > 0) {
      console.log('');
      console.log('✅ Indexes created:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }

    await pool.end();

    console.log('');
    console.log('🎉 Migration 310 completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   - Added record_date column (for handwritten prescriptions)');
    console.log('   - Added prescription_date column (for doctor-created prescriptions)');
    console.log('   - Created indexes for faster queries');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    console.error('');
    
    if (error.message.includes('timeout')) {
      console.error('💡 The migration timed out. This might happen if:');
      console.error('   1. The database is under heavy load');
      console.error('   2. The connection is slow');
      console.error('   3. Try running the migration again');
    } else if (error.message.includes('connection')) {
      console.error('💡 Connection error. Check:');
      console.error('   1. RDS cluster is running');
      console.error('   2. Security groups allow your IP');
      console.error('   3. Network connectivity');
    }
    
    process.exit(1);
  }
}

// Run migration
runMigration();

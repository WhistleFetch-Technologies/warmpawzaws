#!/usr/bin/env node
/**
 * Run Instant Tele Queue Migration on AWS RDS
 * Automatically retrieves credentials from AWS Secrets Manager
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Instant Tele Queue Migration - AWS RDS                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS cluster info
    const { execSync } = require('child_process');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

    console.log('📊 Getting RDS cluster information...');
    const endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
      console.error(`   Make sure you're using the correct environment (${ENVIRONMENT})`);
      process.exit(1);
    }

    const port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    const dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    const username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';

    console.log('✅ RDS Cluster found:');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Username: ${username}`);
    console.log('');

    // Get password from Secrets Manager
    console.log('🔐 Getting database credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });

    // Try to find the secret
    let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    
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
      console.log(`   This may take a moment if database is in a VPC...`);
      const pool = new Pool({
        host: endpoint,
        port: parseInt(port, 10),
        database: dbName,
        user: username,
        password: password,
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 30000, // Increased to 30 seconds
        query_timeout: 60000, // 60 seconds for queries
      });

      // Test connection
      await pool.query('SELECT 1');
      console.log('✅ Connection successful');
      console.log('');

      // Read migration file
      console.log('⚙️  Running migration...');
      console.log('─────────────────────────');
      const migrationPath = path.join(__dirname, '..', 'backend', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ ERROR: Migration file not found: ${migrationPath}`);
        process.exit(1);
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Check current state
      console.log('📊 Current database state:');
      const stateResult = await pool.query(`
        SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_tele_availability')
            THEN '✅ staff_tele_availability exists'
            ELSE '❌ staff_tele_availability missing'
          END as staff_tele_availability_status,
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tele_queue')
            THEN '✅ tele_queue exists'
            ELSE '❌ tele_queue missing'
          END as tele_queue_status;
      `);
      console.log(`   ${stateResult.rows[0].staff_tele_availability_status}`);
      console.log(`   ${stateResult.rows[0].tele_queue_status}`);
      console.log('');

      // Execute migration
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Migration completed!');
        console.log('');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Verify tables
      console.log('🔍 Verifying created tables...');
      const result = await pool.query(`
        SELECT 
          t.table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
          (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
          AND table_name IN ('staff_tele_availability', 'tele_queue')
        ORDER BY table_name;
      `);

      if (result.rows.length > 0) {
        console.log('✅ Created tables:');
        result.rows.forEach(row => {
          console.log(`   - ${row.table_name} (${row.column_count} columns, ${row.index_count} indexes)`);
        });
      } else {
        console.log('⚠️  No tables found (may already exist or migration had issues)');
      }

      // Check indexes
      console.log('');
      console.log('📑 Created indexes:');
      const indexesResult = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE tablename IN ('staff_tele_availability', 'tele_queue')
        ORDER BY tablename, indexname;
      `);

      if (indexesResult.rows.length > 0) {
        indexesResult.rows.forEach(idx => {
          console.log(`   ✅ ${idx.indexname} on ${idx.tablename}`);
        });
      }

      await pool.end();
      console.log('');
      console.log('🎉 Migration and verification complete!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Deploy backend Lambda function');
      console.log('   2. Deploy frontend applications');
      console.log('   3. Test the features');
      console.log('');

    } catch (secretError) {
      console.error('');
      console.error('❌ Failed to get credentials from Secrets Manager:');
      console.error(`   Secret: ${secretName}`);
      console.error(`   Error: ${secretError.message}`);
      console.error('');
      console.error('💡 Alternative: Use the interactive migration script:');
      console.error('   node scripts/run-instant-tele-queue-migration.js');
      console.error('');
      process.exit(1);
    }

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

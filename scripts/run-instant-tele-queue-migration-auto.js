#!/usr/bin/env node

/**
 * Run Instant Tele Queue Migration - Auto Mode
 * Automatically retrieves credentials from AWS Secrets Manager
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('🚀 Starting Instant Tele Queue Database Migration (Auto Mode)...\n');

  let dbHost, dbPort, dbName, dbUser, dbPassword, databaseUrl;

  // Try to get from AWS RDS and Secrets Manager first
  try {
    console.log('📊 Attempting to get database info from AWS...');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    
    dbHost = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (dbHost && dbHost !== 'None' && dbHost !== 'null') {
      dbPort = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
        { encoding: 'utf8' }
      ).trim() || '5432';

      dbName = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
        { encoding: 'utf8' }
      ).trim() || 'warmpawz';

      dbUser = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
        { encoding: 'utf8' }
      ).trim() || 'warmpawz_admin';

      console.log('✅ RDS Cluster found:');
      console.log(`   Endpoint: ${dbHost}`);
      console.log(`   Port: ${dbPort}`);
      console.log(`   Database: ${dbName}`);
      console.log(`   Username: ${dbUser}\n`);

      // Get password from Secrets Manager
      console.log('🔐 Getting password from Secrets Manager...');
      const secretsClient = new SecretsManagerClient({ region: REGION });
      const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
      
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secret = JSON.parse(secretValue.SecretString);
      dbPassword = secret.password || secret.Password || secret.secret || secret.Secret;

      if (!dbPassword) {
        throw new Error('Password not found in secret');
      }

      console.log('✅ Credentials retrieved from AWS\n');
      databaseUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
    }
  } catch (error) {
    console.log('⚠️  Could not get credentials from AWS:', error.message);
    console.log('   Trying environment variables...\n');
    
    // Fall back to environment variables
    dbHost = process.env.DB_HOST || process.env.RDS_HOSTNAME;
    dbPort = process.env.DB_PORT || '5432';
    dbName = process.env.DB_NAME || process.env.RDS_DB_NAME || 'warmpawz_db';
    dbUser = process.env.DB_USER || process.env.RDS_USERNAME;
    dbPassword = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;
    databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl && dbHost && dbUser && dbPassword) {
      databaseUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
    }
  }

  // If still no credentials, show error
  if (!databaseUrl) {
    console.error('❌ Error: No database credentials found!');
    console.error('\nPlease provide credentials via one of these methods:');
    console.error('  1. AWS CLI configured with access to RDS and Secrets Manager');
    console.error('  2. Environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    console.error('  3. DATABASE_URL environment variable');
    console.error('\nOr use the interactive script:');
    console.error('  node scripts/run-instant-tele-queue-migration.js');
    process.exit(1);
  }

  // Read migration file
  const migrationFile = join(__dirname, '..', 'backend', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Error: Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

  console.log(`📁 Migration file: ${migrationFile}`);
  console.log(`🔌 Connecting to database...\n`);

  // Create connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });

  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const testClient = await pool.connect();
    const versionResult = await testClient.query('SELECT version()');
    console.log('✅ Database connection successful');
    console.log(`   PostgreSQL: ${versionResult.rows[0].version.split(' ')[0]} ${versionResult.rows[0].version.split(' ')[1]}\n`);
    testClient.release();

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
    console.log(`   ${stateResult.rows[0].tele_queue_status}\n`);

    // Check if tables already exist
    const existingCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('staff_tele_availability', 'tele_queue');
    `);

    if (existingCheck.rows.length === 2) {
      console.log('⚠️  Tables already exist. Migration will use CREATE TABLE IF NOT EXISTS.');
      console.log('   Continuing with migration...\n');
    }

    console.log('🔄 Running migration...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Execute migration
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query('COMMIT');
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Verify tables created
    console.log('📊 Verifying tables created:');
    const verifyResult = await pool.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
        (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('staff_tele_availability', 'tele_queue')
      ORDER BY table_name;
    `);

    console.table(verifyResult.rows.map(row => ({
      Table: row.table_name,
      Columns: row.column_count,
      Indexes: row.index_count
    })));

    // Check indexes
    console.log('\n📑 Created indexes:');
    const indexesResult = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('staff_tele_availability', 'tele_queue')
      ORDER BY tablename, indexname;
    `);

    indexesResult.rows.forEach(idx => {
      console.log(`   ✅ ${idx.indexname} on ${idx.tablename}`);
    });

    console.log('\n✅ Migration verification complete!\n');
    console.log('🎉 Next steps:');
    console.log('   1. Deploy backend Lambda function');
    console.log('   2. Deploy frontend applications');
    console.log('   3. Test the features\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error(`   Error: ${error.message}`);
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.error('\n💡 Connection timeout - database may be in a VPC.');
      console.error('   Try using AWS RDS Query Editor instead:');
      console.error('   https://console.aws.amazon.com/rds/\n');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

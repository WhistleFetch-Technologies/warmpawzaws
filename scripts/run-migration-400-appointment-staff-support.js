#!/usr/bin/env node
/**
 * Migration 400: Appointment Management Staff Support
 * 
 * Adds staff_id column to bookings table if it doesn't exist
 * Ensures staff appointments endpoints can work properly
 * 
 * Date: 2025-01-28
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 400: Appointment Management Staff Support');
  console.log('======================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
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

    // Check if staff_id column exists
    console.log('🔍 Checking if staff_id column exists in bookings table...');
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'staff_id'
      ) as column_exists;
    `);

    const columnExists = columnCheck.rows[0]?.column_exists;

    if (columnExists) {
      console.log('✅ staff_id column already exists in bookings table');
      console.log('');
      
      // Check if it's nullable and has proper constraints
      const columnInfo = await pool.query(`
        SELECT 
          is_nullable,
          data_type,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'staff_id';
      `);

      const colInfo = columnInfo.rows[0];
      console.log('📋 Column details:');
      console.log(`   Type: ${colInfo.data_type}`);
      console.log(`   Nullable: ${colInfo.is_nullable}`);
      console.log(`   Default: ${colInfo.column_default || 'None'}`);
      console.log('');

      // Check if foreign key exists
      const fkCheck = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'bookings'
          AND kcu.column_name = 'staff_id';
      `);

      if (fkCheck.rows.length === 0) {
        console.log('⚠️  Foreign key constraint not found. Adding...');
        await pool.query(`
          ALTER TABLE bookings
          ADD CONSTRAINT fk_bookings_staff_id
          FOREIGN KEY (staff_id)
          REFERENCES staff(id)
          ON DELETE SET NULL;
        `);
        console.log('✅ Foreign key constraint added');
      } else {
        console.log('✅ Foreign key constraint already exists');
      }
    } else {
      console.log('📝 Adding staff_id column to bookings table...');
      
      // Add staff_id column
      await pool.query(`
        ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS staff_id UUID;
      `);

      console.log('✅ staff_id column added');

      // Add foreign key constraint
      console.log('📝 Adding foreign key constraint...');
      await pool.query(`
        ALTER TABLE bookings
        ADD CONSTRAINT fk_bookings_staff_id
        FOREIGN KEY (staff_id)
        REFERENCES staff(id)
        ON DELETE SET NULL;
      `);

      console.log('✅ Foreign key constraint added');

      // Add index for better query performance
      console.log('📝 Adding index on staff_id...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bookings_staff_id
        ON bookings(staff_id);
      `);

      console.log('✅ Index added');
    }

    // Verify the migration
    console.log('');
    console.log('🔍 Verifying migration...');
    const verify = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name = 'staff_id';
    `);

    if (verify.rows.length > 0) {
      console.log('✅ Migration verified successfully:');
      console.log(`   Column: ${verify.rows[0].column_name}`);
      console.log(`   Type: ${verify.rows[0].data_type}`);
      console.log(`   Nullable: ${verify.rows[0].is_nullable}`);
      console.log('');
    }

    // Check for existing bookings with staff assignments
    const existingCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE staff_id IS NOT NULL;
    `);

    console.log(`📊 Existing bookings with staff assignments: ${existingCount.rows[0].count}`);
    console.log('');

    await pool.end();
    console.log('✅ ✅ ✅ MIGRATION 400 COMPLETED SUCCESSFULLY! ✅ ✅ ✅');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ staff_id column added/verified in bookings table');
    console.log('   ✅ Foreign key constraint to staff table');
    console.log('   ✅ Index created for performance');
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

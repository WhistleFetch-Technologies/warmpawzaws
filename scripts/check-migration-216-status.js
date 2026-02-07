#!/usr/bin/env node
/**
 * Check Migration 216 Status
 * Quick check if migration 216 (tele queue vendor support) is applied
 * 
 * Usage:
 *   node scripts/check-migration-216-status.js
 *   ENVIRONMENT=prod node scripts/check-migration-216-status.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkMigrationStatus() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Migration 216 Status Check                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
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

    // Get password from Secrets Manager
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;

    // Connect to database
    const pool = new Pool({
      host: endpoint,
      port: parseInt(port, 10),
      database: dbName,
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });

    // Check if tele_queue table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tele_queue'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ tele_queue table does not exist!');
      console.log('   Run the instant-tele-queue migration first.');
      await pool.end();
      process.exit(1);
    }

    // Check columns
    const columns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tele_queue' 
        AND column_name IN ('staff_id', 'vendor_id')
      ORDER BY column_name;
    `);

    const columnMap = {};
    columns.rows.forEach(row => {
      columnMap[row.column_name] = row;
    });

    const hasVendorId = columnMap['vendor_id'];
    const staffIdNullable = columnMap['staff_id']?.is_nullable === 'YES';

    console.log('📋 Migration 216 Status:');
    console.log('─────────────────────────');
    
    if (hasVendorId) {
      console.log('✅ vendor_id column: EXISTS');
    } else {
      console.log('❌ vendor_id column: MISSING');
    }

    if (staffIdNullable) {
      console.log('✅ staff_id column: NULLABLE');
    } else {
      console.log('❌ staff_id column: NOT NULL (should be nullable)');
    }

    // Check constraint
    const constraintCheck = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'tele_queue' 
        AND constraint_name = 'tele_queue_provider_check';
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Check constraint: EXISTS (tele_queue_provider_check)');
    } else {
      console.log('⚠️  Check constraint: MISSING (tele_queue_provider_check)');
    }

    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes 
      WHERE tablename = 'tele_queue'
        AND indexname IN (
          'idx_tele_queue_vendor_id',
          'idx_tele_queue_staff_id_status'
        )
      ORDER BY indexname;
    `);

    console.log('\n📑 Indexes:');
    if (indexes.rows.length > 0) {
      indexes.rows.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
      });
    } else {
      console.log('   ⚠️  Expected indexes not found');
    }

    console.log('');
    
    if (hasVendorId && staffIdNullable) {
      console.log('🎉 Migration 216 is FULLY APPLIED!');
      console.log('');
      console.log('✅ All required changes are in place.');
      console.log('   The tele queue should support solo vendors.');
    } else {
      console.log('❌ Migration 216 is NOT FULLY APPLIED');
      console.log('');
      console.log('🔧 To apply migration 216, run:');
      console.log('   node scripts/run-migration-216-tele-queue-vendor-support.js');
      console.log('');
      console.log('⚠️  Without this migration, solo vendors cannot join the tele queue.');
    }

    await pool.end();
  } catch (error) {
    console.error('');
    console.error('❌ Error checking migration status:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.log('');
      console.log('💡 Connection timeout - database may be in a VPC.');
      console.log('   Run this script from:');
      console.log('   - An EC2 instance or bastion host in the VPC');
      console.log('   - A machine with VPN access to the VPC');
    }
    
    process.exit(1);
  }
}

checkMigrationStatus();

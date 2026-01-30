#!/usr/bin/env node
/**
 * Debug Tele Queue 500 Error
 * Comprehensive diagnostic tool for tele queue join errors
 * 
 * Usage:
 *   node scripts/debug-tele-queue-500.js
 *   ENVIRONMENT=prod node scripts/debug-tele-queue-500.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const LOG_GROUP = `/aws/lambda/warmpawz-api-${ENVIRONMENT}-api`;

async function getDbConnection() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  console.log('📊 Getting RDS cluster information...');
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    throw new Error(`RDS cluster not found: ${clusterId}`);
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

  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  return pool;
}

async function checkMigration216(pool) {
  console.log('\n📋 Step 1: Checking Migration 216 Status');
  console.log('─────────────────────────────────────────');
  
  try {
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
      return false;
    }

    // Check columns
    const columns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'tele_queue' 
        AND column_name IN ('staff_id', 'vendor_id', 'customer_id', 'pet_id', 'service_id')
      ORDER BY column_name;
    `);

    console.log('   Table columns:');
    const columnMap = {};
    columns.rows.forEach(row => {
      columnMap[row.column_name] = row;
      const nullable = row.is_nullable === 'YES' ? '✅ nullable' : '❌ NOT NULL';
      console.log(`   - ${row.column_name}: ${row.data_type} (${nullable})`);
    });

    // Check for vendor_id column
    const hasVendorId = columnMap['vendor_id'];
    const staffIdNullable = columnMap['staff_id']?.is_nullable === 'YES';

    if (!hasVendorId) {
      console.log('\n❌ Migration 216 NOT APPLIED');
      console.log('   - vendor_id column is missing');
      console.log('   - Run: node scripts/run-migration-216-tele-queue-vendor-support.js');
      return false;
    }

    if (!staffIdNullable) {
      console.log('\n⚠️  Migration 216 PARTIALLY APPLIED');
      console.log('   - vendor_id column exists ✅');
      console.log('   - staff_id is NOT nullable ❌');
      console.log('   - Run: node scripts/run-migration-216-tele-queue-vendor-support.js');
      return false;
    }

    // Check constraint
    const constraintCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'tele_queue' 
        AND constraint_name = 'tele_queue_provider_check';
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('   ✅ Check constraint exists: tele_queue_provider_check');
    } else {
      console.log('   ⚠️  Check constraint missing: tele_queue_provider_check');
    }

    console.log('\n✅ Migration 216 is applied correctly!');
    return true;
  } catch (error) {
    console.error(`❌ Error checking migration: ${error.message}`);
    return false;
  }
}

async function checkTableData(pool) {
  console.log('\n📋 Step 2: Checking Table Data & Constraints');
  console.log('─────────────────────────────────────────────');
  
  try {
    // Check current queue entries
    const queueCount = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM tele_queue;
    `);

    const counts = queueCount.rows[0];
    console.log('   Queue entries:');
    console.log(`   - Total: ${counts.total}`);
    console.log(`   - Waiting: ${counts.waiting}`);
    console.log(`   - Active: ${counts.active}`);
    console.log(`   - Completed: ${counts.completed}`);
    console.log(`   - Cancelled: ${counts.cancelled}`);

    // Check for entries with NULL staff_id and NULL vendor_id (invalid state)
    const invalidEntries = await pool.query(`
      SELECT COUNT(*) as count
      FROM tele_queue
      WHERE staff_id IS NULL AND vendor_id IS NULL;
    `);

    if (invalidEntries.rows[0].count > 0) {
      console.log(`\n   ⚠️  Found ${invalidEntries.rows[0].count} invalid entries (both staff_id and vendor_id are NULL)`);
    } else {
      console.log('\n   ✅ No invalid entries found');
    }

    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename = 'tele_queue'
      ORDER BY indexname;
    `);

    if (indexes.rows.length > 0) {
      console.log('\n   Indexes:');
      indexes.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }

    return true;
  } catch (error) {
    console.error(`❌ Error checking table data: ${error.message}`);
    return false;
  }
}

async function checkCloudWatchLogs() {
  console.log('\n📋 Step 3: Checking Recent CloudWatch Logs');
  console.log('───────────────────────────────────────────');
  
  try {
    // Get logs from last 30 minutes
    const startTime = Math.floor((Date.now() - 30 * 60 * 1000) / 1000) * 1000;
    
    console.log(`   Log Group: ${LOG_GROUP}`);
    console.log(`   Time Range: Last 30 minutes`);
    console.log('');

    // Search for tele queue errors
    console.log('   🔍 Searching for tele queue errors...');
    try {
      const errorLogs = execSync(
        `aws logs filter-log-events \
          --log-group-name "${LOG_GROUP}" \
          --start-time ${startTime} \
          --region ${REGION} \
          --filter-pattern "TELE-QUEUE" \
          --max-items 20`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );

      const logs = JSON.parse(errorLogs);
      if (logs.events && logs.events.length > 0) {
        console.log(`   Found ${logs.events.length} tele queue log entries:`);
        logs.events.slice(0, 10).forEach((event, idx) => {
          const date = new Date(event.timestamp);
          const message = event.message.substring(0, 200);
          console.log(`   ${idx + 1}. [${date.toISOString()}] ${message}`);
        });
      } else {
        console.log('   ℹ️  No tele queue log entries found in last 30 minutes');
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch logs (may need AWS CLI or permissions)');
      console.log(`   Error: ${error.message}`);
    }

    // Search for 500 errors
    console.log('\n   🔍 Searching for 500 errors...');
    try {
      const error500Logs = execSync(
        `aws logs filter-log-events \
          --log-group-name "${LOG_GROUP}" \
          --start-time ${startTime} \
          --region ${REGION} \
          --filter-pattern "500" \
          --max-items 10`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );

      const logs = JSON.parse(error500Logs);
      if (logs.events && logs.events.length > 0) {
        console.log(`   Found ${logs.events.length} entries with 500:`);
        logs.events.slice(0, 5).forEach((event, idx) => {
          const date = new Date(event.timestamp);
          const message = event.message.substring(0, 150);
          console.log(`   ${idx + 1}. [${date.toISOString()}] ${message}`);
        });
      } else {
        console.log('   ℹ️  No 500 errors found in last 30 minutes');
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch 500 error logs');
    }

    // Search for UUID errors
    console.log('\n   🔍 Searching for UUID type mismatch errors...');
    try {
      const uuidErrorLogs = execSync(
        `aws logs filter-log-events \
          --log-group-name "${LOG_GROUP}" \
          --start-time ${startTime} \
          --region ${REGION} \
          --filter-pattern "uuid = text" \
          --max-items 5`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );

      const logs = JSON.parse(uuidErrorLogs);
      if (logs.events && logs.events.length > 0) {
        console.log(`   ⚠️  Found ${logs.events.length} UUID type mismatch errors:`);
        logs.events.forEach((event, idx) => {
          const date = new Date(event.timestamp);
          console.log(`   ${idx + 1}. [${date.toISOString()}] ${event.message.substring(0, 200)}`);
        });
      } else {
        console.log('   ✅ No UUID type mismatch errors found');
      }
    } catch (error) {
      console.log('   ℹ️  Could not check for UUID errors');
    }

    return true;
  } catch (error) {
    console.error(`❌ Error checking CloudWatch logs: ${error.message}`);
    return false;
  }
}

async function checkServiceSchema(pool) {
  console.log('\n📋 Step 4: Checking Service Schema Compatibility');
  console.log('─────────────────────────────────────────────────');
  
  try {
    // Check staff_services columns
    const staffServicesColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'staff_services'
        AND column_name IN ('service_styles', 'service_style', 'service_name')
      ORDER BY column_name;
    `);

    const hasServiceStyles = staffServicesColumns.rows.some(r => r.column_name === 'service_styles');
    const hasServiceStyle = staffServicesColumns.rows.some(r => r.column_name === 'service_style');
    const hasServiceName = staffServicesColumns.rows.some(r => r.column_name === 'service_name');

    console.log('   staff_services columns:');
    console.log(`   - service_styles: ${hasServiceStyles ? '✅' : '❌'}`);
    console.log(`   - service_style: ${hasServiceStyle ? '✅' : '❌'}`);
    console.log(`   - service_name: ${hasServiceName ? '✅' : '❌'}`);

    if (!hasServiceStyles && !hasServiceStyle) {
      console.log('\n   ⚠️  Neither service_styles nor service_style column found');
      console.log('   The code has fallback logic, but this may cause issues');
    }

    return true;
  } catch (error) {
    console.error(`❌ Error checking service schema: ${error.message}`);
    return false;
  }
}

async function runDiagnostics() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Tele Queue 500 Error Diagnostics                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  let pool;
  try {
    pool = await getDbConnection();
    console.log('✅ Database connection established');
    console.log('');

    const migrationOk = await checkMigration216(pool);
    const dataOk = await checkTableData(pool);
    const schemaOk = await checkServiceSchema(pool);
    
    await checkCloudWatchLogs();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Diagnostic Summary                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Migration 216 Status: ${migrationOk ? '✅ Applied' : '❌ Not Applied'}`);
    console.log(`Table Data Check: ${dataOk ? '✅ Passed' : '❌ Failed'}`);
    console.log(`Schema Check: ${schemaOk ? '✅ Passed' : '❌ Failed'}`);
    console.log('');

    if (!migrationOk) {
      console.log('🔧 RECOMMENDED ACTIONS:');
      console.log('   1. Run migration 216:');
      console.log('      node scripts/run-migration-216-tele-queue-vendor-support.js');
      console.log('   2. Deploy backend with latest error handling fixes');
      console.log('   3. Test queue joining again');
    } else {
      console.log('✅ Database schema looks good!');
      console.log('');
      console.log('🔍 If errors persist:');
      console.log('   1. Check CloudWatch logs for detailed error messages');
      console.log('   2. Verify request payload has valid UUIDs');
      console.log('   3. Check if provider/service exists in database');
      console.log('   4. Review error response for specific error code');
    }

    await pool.end();
  } catch (error) {
    console.error('');
    console.error('❌ Diagnostic failed:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.log('');
      console.log('💡 Connection timeout - database may be in a VPC.');
      console.log('   Run this script from:');
      console.log('   - An EC2 instance or bastion host in the VPC');
      console.log('   - A machine with VPN access to the VPC');
    }
    
    if (pool) await pool.end();
    process.exit(1);
  }
}

runDiagnostics().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

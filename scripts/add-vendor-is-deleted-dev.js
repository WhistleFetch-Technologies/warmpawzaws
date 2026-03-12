/**
 * Migration: Add is_deleted column to vendors and vendor_identity tables, and create unique index
 * Environment: Dev
 * Method: AWS CLI with RDS Data API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'dev';
const CLUSTER_ID = 'warmpawz-dev-cluster';
const SECRET_NAME = 'warmpawz-dev-rds-master-20260106164510791100000002';
const DB_NAME = 'warmpawz';

// Cache cluster and secret info
let clusterArn = null;
let secretArn = null;

async function getClusterInfo() {
  if (clusterArn && secretArn) {
    return { clusterArn, secretArn };
  }
  
  // Get cluster ARN
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${CLUSTER_ID}`);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  clusterArn = cluster.DBClusterArn;
  
  if (!cluster.HttpEndpointEnabled) {
    throw new Error('RDS Data API is not enabled on this cluster');
  }
  
  // Get secret ARN
  const secretInfo = JSON.parse(execSync(
    `aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  secretArn = secretInfo.ARN;
  
  return { clusterArn, secretArn };
}

async function executeSQL(sql, expectResult = false) {
  try {
    const { clusterArn: resourceArn, secretArn: secret } = await getClusterInfo();
    
    // Write SQL to temp file to avoid shell escaping issues
    const tmpFile = path.join(__dirname, `_tmp_stmt_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql, 'utf8');
    
    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${resourceArn}" --secret-arn "${secret}" --database "${DB_NAME}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8', stdio: expectResult ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'] }
      );
      
      return expectResult ? JSON.parse(result) : { success: true };
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    // Check if it's a "already exists" error (which is OK)
    const errorOutput = error.stderr ? error.stderr.toString() : error.message || '';
    if (errorOutput.includes('already exists') || 
        errorOutput.includes('duplicate') ||
        (errorOutput.includes('column') && errorOutput.includes('already'))) {
      return { status: 'already_exists' };
    }
    throw error;
  }
}

async function checkColumnExists(tableName, columnName) {
  const sql = `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}') as exists;`;
  
  try {
    const result = await executeSQL(sql, true);
    if (result.records && result.records.length > 0) {
      return result.records[0][0].booleanValue === true;
    }
    return false;
  } catch (error) {
    console.warn(`Error checking column existence: ${error.message}`);
    return false;
  }
}

async function checkIndexExists(indexName) {
  const sql = `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '${indexName}') as exists;`;
  
  try {
    const result = await executeSQL(sql, true);
    if (result.records && result.records.length > 0) {
      return result.records[0][0].booleanValue === true;
    }
    return false;
  } catch (error) {
    console.warn(`Error checking index existence: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('MIGRATION: Add is_deleted column and unique index');
  console.log('Environment: DEV');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Add is_deleted to vendor_identity table
    console.log('📋 Step 1: Checking is_deleted column in vendor_identity table...');
    const vendorIdentityHasIsDeleted = await checkColumnExists('vendor_identity', 'is_deleted');
    
    if (!vendorIdentityHasIsDeleted) {
      console.log('   ⚠️  Column does not exist. Adding is_deleted column...');
      await executeSQL('ALTER TABLE vendor_identity ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;');
      console.log('   ✅ Column added successfully');
    } else {
      console.log('   ✅ Column already exists');
    }
    console.log('');

    // Step 2: Add is_deleted to vendors table
    console.log('📋 Step 2: Checking is_deleted column in vendors table...');
    const vendorsHasIsDeleted = await checkColumnExists('vendors', 'is_deleted');
    
    if (!vendorsHasIsDeleted) {
      console.log('   ⚠️  Column does not exist. Adding is_deleted column...');
      await executeSQL('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;');
      console.log('   ✅ Column added successfully');
    } else {
      console.log('   ✅ Column already exists');
    }
    console.log('');

    // Step 3: Create unique index on vendors.phone
    console.log('📋 Step 3: Checking unique index idx_vendors_phone_unique_active...');
    const vendorsIndexExists = await checkIndexExists('idx_vendors_phone_unique_active');
    
    if (!vendorsIndexExists) {
      console.log('   ⚠️  Index does not exist. Creating unique index...');
      await executeSQL('CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_phone_unique_active ON vendors (phone) WHERE is_deleted = false;');
      console.log('   ✅ Index created successfully');
    } else {
      console.log('   ✅ Index already exists');
    }
    console.log('');

    // Step 4: Verify migration
    console.log('📋 Step 4: Verifying migration...');
    const vendorIdentityHasColumn = await checkColumnExists('vendor_identity', 'is_deleted');
    const vendorsHasColumn = await checkColumnExists('vendors', 'is_deleted');
    const vendorsHasIndex = await checkIndexExists('idx_vendors_phone_unique_active');
    
    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION VERIFICATION');
    console.log('='.repeat(80));
    console.log(`vendor_identity.is_deleted:              ${vendorIdentityHasColumn ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`vendors.is_deleted:                      ${vendorsHasColumn ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`idx_vendors_phone_unique_active:         ${vendorsHasIndex ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log('='.repeat(80));
    
    if (vendorIdentityHasColumn && vendorsHasColumn && vendorsHasIndex) {
      console.log('');
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('');
    } else {
      console.log('');
      console.log('⚠️  MIGRATION INCOMPLETE - Some items are missing');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ MIGRATION FAILED');
    console.error('='.repeat(80));
    console.error(error.message);
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    console.error('');
    process.exit(1);
  }
}

main();

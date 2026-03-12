/**
 * Check if vendor with phone 9108664595 exists in production RDS
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';
const TARGET_PHONE = '9108664595';

// Cache cluster and secret info
let clusterArn = null;
let secretArn = null;

async function getClusterInfo() {
  if (clusterArn && secretArn) {
    return { clusterArn, secretArn };
  }
  
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
    
    const tmpFile = path.join(__dirname, `_tmp_stmt_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql, 'utf8');
    
    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${resourceArn}" --secret-arn "${secret}" --database "${DB_NAME}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8', stdio: expectResult ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'] }
      );
      
      return expectResult ? JSON.parse(result) : { success: true };
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    throw error;
  }
}

async function checkVendor(phone) {
  const sql = `SELECT id, business_name, owner_name, phone, email, status, is_deleted, created_at FROM vendors WHERE phone = '${phone}' LIMIT 1;`;
  const result = await executeSQL(sql, true);
  
  if (result.records && result.records.length > 0) {
    const record = result.records[0];
    return {
      id: record[0].stringValue,
      business_name: record[1]?.stringValue || null,
      owner_name: record[2]?.stringValue || null,
      phone: record[3].stringValue,
      email: record[4]?.stringValue || null,
      status: record[5]?.stringValue || null,
      is_deleted: record[6]?.booleanValue || false,
      created_at: record[7]?.stringValue || null
    };
  }
  return null;
}

async function checkVendorIdentity(phone) {
  const sql = `SELECT id, phone, vendor_id, onboarding_status, is_deleted, created_at FROM vendor_identity WHERE phone = '${phone}' LIMIT 1;`;
  const result = await executeSQL(sql, true);
  
  if (result.records && result.records.length > 0) {
    const record = result.records[0];
    return {
      id: record[0].stringValue,
      phone: record[1].stringValue,
      vendor_id: record[2]?.stringValue || null,
      onboarding_status: record[3]?.stringValue || null,
      is_deleted: record[4]?.booleanValue || false,
      created_at: record[5]?.stringValue || null
    };
  }
  return null;
}

async function main() {
  console.log('='.repeat(80));
  console.log('CHECKING VENDOR IN PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Phone Number: ${TARGET_PHONE}`);
  console.log('');

  try {
    // Check vendors table
    console.log('📋 Checking vendors table...');
    const vendor = await checkVendor(TARGET_PHONE);
    
    if (vendor) {
      console.log('   ✅ Vendor found in vendors table:');
      console.log(`      ID: ${vendor.id}`);
      console.log(`      Business Name: ${vendor.business_name || 'N/A'}`);
      console.log(`      Owner Name: ${vendor.owner_name || 'N/A'}`);
      console.log(`      Phone: ${vendor.phone}`);
      console.log(`      Email: ${vendor.email || 'N/A'}`);
      console.log(`      Status: ${vendor.status || 'N/A'}`);
      console.log(`      Is Deleted: ${vendor.is_deleted ? 'YES' : 'NO'}`);
      console.log(`      Created At: ${vendor.created_at || 'N/A'}`);
      console.log('');
    } else {
      console.log('   ❌ No vendor found in vendors table');
      console.log('');
    }
    
    // Check vendor_identity table
    console.log('📋 Checking vendor_identity table...');
    const vendorIdentity = await checkVendorIdentity(TARGET_PHONE);
    
    if (vendorIdentity) {
      console.log('   ✅ Vendor identity found:');
      console.log(`      ID: ${vendorIdentity.id}`);
      console.log(`      Phone: ${vendorIdentity.phone}`);
      console.log(`      Vendor ID: ${vendorIdentity.vendor_id || 'N/A'}`);
      console.log(`      Onboarding Status: ${vendorIdentity.onboarding_status || 'N/A'}`);
      console.log(`      Is Deleted: ${vendorIdentity.is_deleted ? 'YES' : 'NO'}`);
      console.log(`      Created At: ${vendorIdentity.created_at || 'N/A'}`);
      console.log('');
    } else {
      console.log('   ❌ No vendor identity found');
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    
    if (vendor || vendorIdentity) {
      console.log('✅ Vendor exists in production RDS');
      console.log('');
      if (vendor) {
        console.log('   Found in vendors table');
        if (vendor.is_deleted) {
          console.log('   ⚠️  WARNING: Vendor is soft-deleted');
        }
      }
      if (vendorIdentity) {
        console.log('   Found in vendor_identity table');
        if (vendorIdentity.is_deleted) {
          console.log('   ⚠️  WARNING: Vendor identity is soft-deleted');
        }
      }
    } else {
      console.log('❌ No vendor found with phone number:', TARGET_PHONE);
      console.log('   Checked both vendors and vendor_identity tables');
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ CHECK FAILED');
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

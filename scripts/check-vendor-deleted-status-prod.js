/**
 * Check if vendor c630354a-529d-49f4-a975-776e481c3aa1 is marked as deleted
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';
const VENDOR_ID = 'c630354a-529d-49f4-a975-776e481c3aa1';

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

async function checkVendor(vendorId) {
  const sql = `SELECT id, business_name, owner_name, phone, email, status, is_deleted, created_at, updated_at FROM vendors WHERE id = '${vendorId}' LIMIT 1;`;
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
      created_at: record[7]?.stringValue || null,
      updated_at: record[8]?.stringValue || null
    };
  }
  return null;
}

async function checkVendorIdentityByVendorId(vendorId) {
  const sql = `SELECT id, phone, vendor_id, onboarding_status, is_deleted, created_at FROM vendor_identity WHERE vendor_id = '${vendorId}' LIMIT 1;`;
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
  console.log('CHECKING VENDOR DELETED STATUS IN PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Vendor ID: ${VENDOR_ID}`);
  console.log('');

  try {
    // Check vendors table
    console.log('📋 Checking vendors table...');
    const vendor = await checkVendor(VENDOR_ID);
    
    if (vendor) {
      console.log('   ✅ Vendor found:');
      console.log(`      ID: ${vendor.id}`);
      console.log(`      Business Name: ${vendor.business_name || 'N/A'}`);
      console.log(`      Owner Name: ${vendor.owner_name || 'N/A'}`);
      console.log(`      Phone: ${vendor.phone}`);
      console.log(`      Email: ${vendor.email || 'N/A'}`);
      console.log(`      Status: ${vendor.status || 'N/A'}`);
      console.log(`      Is Deleted: ${vendor.is_deleted ? 'YES ⚠️' : 'NO ✅'}`);
      console.log(`      Created At: ${vendor.created_at || 'N/A'}`);
      console.log(`      Updated At: ${vendor.updated_at || 'N/A'}`);
      console.log('');
    } else {
      console.log('   ❌ Vendor not found in vendors table');
      console.log('');
    }
    
    // Check vendor_identity table
    let vendorIdentity = null;
    if (vendor) {
      console.log('📋 Checking vendor_identity table...');
      vendorIdentity = await checkVendorIdentityByVendorId(VENDOR_ID);
      
      if (vendorIdentity) {
        console.log('   ✅ Vendor identity found:');
        console.log(`      ID: ${vendorIdentity.id}`);
        console.log(`      Phone: ${vendorIdentity.phone}`);
        console.log(`      Vendor ID: ${vendorIdentity.vendor_id || 'N/A'}`);
        console.log(`      Onboarding Status: ${vendorIdentity.onboarding_status || 'N/A'}`);
        console.log(`      Is Deleted: ${vendorIdentity.is_deleted ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`      Created At: ${vendorIdentity.created_at || 'N/A'}`);
        console.log('');
      } else {
        console.log('   ⚠️  No vendor identity linked to this vendor ID');
        console.log('');
      }
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('DELETION STATUS SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    
    if (vendor) {
      if (vendor.is_deleted) {
        console.log('❌ VENDOR IS MARKED AS DELETED (is_deleted = true)');
        console.log('');
        console.log('   This vendor has been soft-deleted in the vendors table.');
        console.log('   The record still exists but is marked as deleted.');
      } else {
        console.log('✅ VENDOR IS NOT DELETED (is_deleted = false)');
        console.log('');
        console.log('   This vendor is active and not marked as deleted.');
      }
      
      if (vendorIdentity) {
        if (vendorIdentity.is_deleted) {
          console.log('   ⚠️  Vendor identity is also marked as deleted');
        } else {
          console.log('   ✅ Vendor identity is not deleted');
        }
      }
    } else {
      console.log('❌ Vendor not found - cannot check deletion status');
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

/**
 * Check for vendors with owner name "Karan Charles" in production RDS
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';
const TARGET_NAME = 'Karan Charles';

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

async function searchVendorsByName(ownerName) {
  // Search case-insensitive and partial match
  const sql = `SELECT id, business_name, owner_name, phone, email, status, is_deleted, created_at FROM vendors WHERE LOWER(owner_name) LIKE LOWER('%${ownerName.replace(/'/g, "''")}%') ORDER BY created_at DESC;`;
  const result = await executeSQL(sql, true);
  
  if (result.records && result.records.length > 0) {
    return result.records.map(record => ({
      id: record[0].stringValue,
      business_name: record[1]?.stringValue || null,
      owner_name: record[2]?.stringValue || null,
      phone: record[3].stringValue,
      email: record[4]?.stringValue || null,
      status: record[5]?.stringValue || null,
      is_deleted: record[6]?.booleanValue || false,
      created_at: record[7]?.stringValue || null
    }));
  }
  return [];
}

async function main() {
  console.log('='.repeat(80));
  console.log('SEARCHING FOR VENDORS BY OWNER NAME IN PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Searching for: "${TARGET_NAME}"`);
  console.log('');

  try {
    // Search vendors table
    console.log('📋 Searching vendors table...');
    const vendors = await searchVendorsByName(TARGET_NAME);
    
    if (vendors.length > 0) {
      console.log(`   ✅ Found ${vendors.length} vendor(s) with owner name containing "${TARGET_NAME}":`);
      console.log('');
      
      vendors.forEach((vendor, index) => {
        console.log(`   ${index + 1}. Vendor:`);
        console.log(`      ID: ${vendor.id}`);
        console.log(`      Business Name: ${vendor.business_name || 'N/A'}`);
        console.log(`      Owner Name: ${vendor.owner_name || 'N/A'}`);
        console.log(`      Phone: ${vendor.phone}`);
        console.log(`      Email: ${vendor.email || 'N/A'}`);
        console.log(`      Status: ${vendor.status || 'N/A'}`);
        console.log(`      Is Deleted: ${vendor.is_deleted ? 'YES ⚠️' : 'NO'}`);
        console.log(`      Created At: ${vendor.created_at || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`   ❌ No vendors found with owner name containing "${TARGET_NAME}"`);
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    
    if (vendors.length > 0) {
      const activeVendors = vendors.filter(v => !v.is_deleted);
      const deletedVendors = vendors.filter(v => v.is_deleted);
      
      console.log(`Total vendors found: ${vendors.length}`);
      console.log(`   Active (not deleted): ${activeVendors.length}`);
      console.log(`   Deleted: ${deletedVendors.length}`);
      console.log('');
      
      if (activeVendors.length > 1) {
        console.log('⚠️  Multiple active vendors found with this owner name:');
        activeVendors.forEach((v, i) => {
          console.log(`   ${i + 1}. ${v.business_name || 'N/A'} (${v.phone}) - ${v.status}`);
        });
        console.log('');
      }
    } else {
      console.log(`❌ No vendors found with owner name containing "${TARGET_NAME}"`);
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ SEARCH FAILED');
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

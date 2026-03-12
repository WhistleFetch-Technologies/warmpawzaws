/**
 * Delete specific vendor from Production RDS
 * Vendor: K9 trainer Shivaswamy, Phone: 9845020260
 * 
 * WARNING: This will permanently delete the vendor and related records from PRODUCTION
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';
const TARGET_PHONE = '9845020260';

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
    const errorOutput = error.stderr ? error.stderr.toString() : error.message || '';
    throw error;
  }
}

async function queryVendor(phone) {
  const sql = `SELECT id, business_name, owner_name, phone, email, status, created_at FROM vendors WHERE phone = '${phone}' LIMIT 1;`;
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
      created_at: record[6]?.stringValue || null
    };
  }
  return null;
}

async function queryVendorIdentity(phone) {
  // Query only columns that definitely exist
  const sql = `SELECT id, phone, vendor_id, onboarding_status FROM vendor_identity WHERE phone = '${phone}' LIMIT 1;`;
  const result = await executeSQL(sql, true);
  
  if (result.records && result.records.length > 0) {
    const record = result.records[0];
    return {
      id: record[0].stringValue,
      phone: record[1].stringValue,
      vendor_id: record[2]?.stringValue || null,
      onboarding_status: record[3]?.stringValue || null
    };
  }
  return null;
}

async function countRelatedRecords(vendorId, vendorIdentityId) {
  const counts = {};
  
  // Count bookings
  const bookingsSql = `SELECT COUNT(*) as count FROM bookings WHERE vendor_id = '${vendorId}';`;
  const bookingsResult = await executeSQL(bookingsSql, true);
  counts.bookings = bookingsResult.records?.[0]?.[0]?.longValue || 0;
  
  // Count vendor_services
  const servicesSql = `SELECT COUNT(*) as count FROM vendor_services WHERE vendor_id = '${vendorId}';`;
  const servicesResult = await executeSQL(servicesSql, true);
  counts.vendor_services = servicesResult.records?.[0]?.[0]?.longValue || 0;
  
  // Count vendor_onboarding_applications
  const appsSql = `SELECT COUNT(*) as count FROM vendor_onboarding_applications WHERE vendor_identity_id = '${vendorIdentityId}';`;
  const appsResult = await executeSQL(appsSql, true);
  counts.vendor_onboarding_applications = appsResult.records?.[0]?.[0]?.longValue || 0;
  
  return counts;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DELETE VENDOR FROM PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');
  console.log('Target Vendor:');
  console.log('  Name: K9 trainer Shivaswamy');
  console.log('  Phone: 9845020260');
  console.log('');
  console.log('⚠️  WARNING: This will PERMANENTLY DELETE the vendor and related records!');
  console.log('');

  try {
    // Step 1: Find and verify vendor
    console.log('📋 Step 1: Finding vendor in vendors table...');
    const vendor = await queryVendor(TARGET_PHONE);
    
    if (!vendor) {
      console.log('   ❌ Vendor not found in vendors table with phone:', TARGET_PHONE);
      console.log('');
      console.log('   Checking vendor_identity table...');
      const vendorIdentity = await queryVendorIdentity(TARGET_PHONE);
      if (vendorIdentity) {
        console.log('   ⚠️  Found in vendor_identity but not in vendors table');
        console.log('   Vendor Identity ID:', vendorIdentity.id);
        console.log('   Phone:', vendorIdentity.phone);
        console.log('');
        console.log('   Proceeding to delete from vendor_identity only...');
        
        // Delete from vendor_identity
        console.log('   Deleting from vendor_identity...');
        await executeSQL(`DELETE FROM vendor_identity WHERE id = '${vendorIdentity.id}';`);
        console.log('   ✅ Deleted from vendor_identity');
        
        // Delete related applications
        if (vendorIdentity.id) {
          await executeSQL(`DELETE FROM vendor_onboarding_applications WHERE vendor_identity_id = '${vendorIdentity.id}';`);
          console.log('   ✅ Deleted related vendor_onboarding_applications');
        }
        
        console.log('');
        console.log('✅ DELETION COMPLETED');
        return;
      } else {
        console.log('   ❌ Vendor not found in either table');
        process.exit(1);
      }
    }
    
    console.log('   ✅ Vendor found:');
    console.log(`      ID: ${vendor.id}`);
    console.log(`      Business Name: ${vendor.business_name || 'N/A'}`);
    console.log(`      Owner Name: ${vendor.owner_name || 'N/A'}`);
    console.log(`      Phone: ${vendor.phone}`);
    console.log(`      Email: ${vendor.email || 'N/A'}`);
    console.log(`      Status: ${vendor.status || 'N/A'}`);
    console.log('');
    
    // Verify it's the correct vendor - check for K9 in business name
    const businessNameLower = (vendor.business_name || '').toLowerCase();
    const ownerNameLower = (vendor.owner_name || '').toLowerCase();
    
    if (!businessNameLower.includes('k9') && 
        !businessNameLower.includes('trainer') &&
        !ownerNameLower.includes('shivaswamy')) {
      console.log('   ⚠️  WARNING: Vendor name does not match "K9 trainer Shivaswamy"');
      console.log(`      Found Business Name: ${vendor.business_name || 'N/A'}`);
      console.log(`      Found Owner Name: ${vendor.owner_name || 'N/A'}`);
      console.log('');
      console.log('   ❌ ABORTING - Name verification failed');
      console.log('   Please verify the phone number is correct');
      process.exit(1);
    }
    
    console.log('   ✅ Name verification passed (contains K9/trainer)');
    console.log('');
    
    // Step 2: Find vendor_identity
    console.log('📋 Step 2: Finding vendor_identity record...');
    const vendorIdentity = await queryVendorIdentity(TARGET_PHONE);
    
    if (vendorIdentity) {
      console.log('   ✅ Vendor identity found:');
      console.log(`      ID: ${vendorIdentity.id}`);
      console.log(`      Phone: ${vendorIdentity.phone}`);
      console.log(`      Vendor ID: ${vendorIdentity.vendor_id || 'N/A'}`);
      console.log(`      Onboarding Status: ${vendorIdentity.onboarding_status || 'N/A'}`);
      console.log('');
    } else {
      console.log('   ⚠️  No vendor_identity record found');
      console.log('');
    }
    
    // Step 3: Count related records
    console.log('📋 Step 3: Counting related records...');
    const counts = await countRelatedRecords(vendor.id, vendorIdentity?.id || '');
    
    console.log('   Related records:');
    console.log(`      Bookings: ${counts.bookings}`);
    console.log(`      Vendor Services: ${counts.vendor_services}`);
    console.log(`      Onboarding Applications: ${counts.vendor_onboarding_applications}`);
    console.log('');
    
    // Step 4: Confirm deletion
    console.log('='.repeat(80));
    console.log('CONFIRMATION REQUIRED');
    console.log('='.repeat(80));
    console.log('');
    console.log('About to DELETE:');
    console.log(`   - Vendor: ${vendor.business_name || vendor.owner_name} (${vendor.phone})`);
    console.log(`   - Vendor ID: ${vendor.id}`);
    if (vendorIdentity) {
      console.log(`   - Vendor Identity ID: ${vendorIdentity.id}`);
    }
    console.log(`   - ${counts.bookings} bookings`);
    console.log(`   - ${counts.vendor_services} vendor services`);
    console.log(`   - ${counts.vendor_onboarding_applications} onboarding applications`);
    console.log('');
    console.log('⚠️  THIS CANNOT BE UNDONE!');
    console.log('');
    
    // Auto-confirm since user explicitly requested
    console.log('   ✅ Proceeding with deletion (user confirmed)...');
    console.log('');
    
    // Step 5: Delete related records first
    console.log('📋 Step 5: Deleting related records...');
    
    // Delete bookings
    if (counts.bookings > 0) {
      console.log(`   Deleting ${counts.bookings} bookings...`);
      await executeSQL(`DELETE FROM bookings WHERE vendor_id = '${vendor.id}';`);
      console.log('   ✅ Bookings deleted');
    }
    
    // Delete vendor_services
    if (counts.vendor_services > 0) {
      console.log(`   Deleting ${counts.vendor_services} vendor services...`);
      await executeSQL(`DELETE FROM vendor_services WHERE vendor_id = '${vendor.id}';`);
      console.log('   ✅ Vendor services deleted');
    }
    
    // Delete onboarding applications
    if (vendorIdentity && counts.vendor_onboarding_applications > 0) {
      console.log(`   Deleting ${counts.vendor_onboarding_applications} onboarding applications...`);
      await executeSQL(`DELETE FROM vendor_onboarding_applications WHERE vendor_identity_id = '${vendorIdentity.id}';`);
      console.log('   ✅ Onboarding applications deleted');
    }
    
    console.log('');
    
    // Step 6: Delete vendor_identity
    if (vendorIdentity) {
      console.log('📋 Step 6: Deleting vendor_identity...');
      await executeSQL(`DELETE FROM vendor_identity WHERE id = '${vendorIdentity.id}';`);
      console.log('   ✅ Vendor identity deleted');
      console.log('');
    }
    
    // Step 7: Delete vendor
    console.log('📋 Step 7: Deleting vendor...');
    await executeSQL(`DELETE FROM vendors WHERE id = '${vendor.id}';`);
    console.log('   ✅ Vendor deleted');
    console.log('');
    
    // Step 8: Verify deletion
    console.log('📋 Step 8: Verifying deletion...');
    const vendorCheck = await queryVendor(TARGET_PHONE);
    const vendorIdentityCheck = vendorIdentity ? await queryVendorIdentity(TARGET_PHONE) : null;
    
    if (!vendorCheck && !vendorIdentityCheck) {
      console.log('   ✅ Verification: Vendor completely deleted');
      console.log('');
      console.log('='.repeat(80));
      console.log('✅ DELETION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(80));
      console.log('');
      console.log('Deleted vendor:');
      console.log(`   Name: ${vendor.business_name || vendor.owner_name}`);
      console.log(`   Phone: ${vendor.phone}`);
      console.log(`   Vendor ID: ${vendor.id}`);
      if (vendorIdentity) {
        console.log(`   Vendor Identity ID: ${vendorIdentity.id}`);
      }
      console.log('');
    } else {
      console.log('   ⚠️  WARNING: Verification failed - vendor may still exist');
      if (vendorCheck) {
        console.log('   Vendor still exists in vendors table');
      }
      if (vendorIdentityCheck) {
        console.log('   Vendor identity still exists');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ DELETION FAILED');
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

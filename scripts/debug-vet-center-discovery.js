/**
 * Debug script to investigate why vet center vendor is not appearing in discover-services
 * Vendor ID: 863d5f9f-2cec-4792-9ea8-64c98059061c
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PROD_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Please set DATABASE_URL environment variable.');
  console.error('   Example: $env:DATABASE_URL="postgresql://user:pass@host:5432/db" node scripts/debug-vet-center-discovery.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const VENDOR_ID = '863d5f9f-2cec-4792-9ea8-64c98059061c';

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function debugVendor() {
  console.log('='.repeat(80));
  console.log('DEBUGGING VET CENTER DISCOVERY');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}\n`);

  // 1. Check vendor basic info
  console.log('1. VENDOR BASIC INFO:');
  console.log('-'.repeat(80));
  const vendorInfo = await query(`
    SELECT 
      v.id, v.business_name, v.status, v.is_active, v.role_id, v.category,
      r.name as role_name, r.display_name as role_display_name,
      v.vendor_type, v.latitude, v.longitude
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
    WHERE v.id = $1
  `, [VENDOR_ID]);
  
  if (vendorInfo.rows.length === 0) {
    console.log('❌ VENDOR NOT FOUND!');
    await pool.end();
    return;
  }
  
  const vendor = vendorInfo.rows[0];
  console.log(JSON.stringify(vendor, null, 2));
  console.log('');

  // 2. Check vendor services
  console.log('2. VENDOR SERVICES:');
  console.log('-'.repeat(80));
  const services = await query(`
    SELECT 
      vs.id, vs.service_id, vs.service_name, vs.service_style, 
      vs.is_enabled, vs.publish_status, vs.category,
      vs.custom_price, vs.custom_duration
    FROM vendor_services vs
    WHERE vs.vendor_id = $1
    ORDER BY vs.created_at DESC
  `, [VENDOR_ID]);
  
  console.log(`Found ${services.rows.length} service(s):`);
  services.rows.forEach((s, i) => {
    console.log(`\nService ${i + 1}:`);
    console.log(JSON.stringify(s, null, 2));
  });
  console.log('');

  // 3. Check if vendor has at_center services
  console.log('3. AT_CENTER SERVICES CHECK:');
  console.log('-'.repeat(80));
  const atCenterServices = await query(`
    SELECT 
      vs.id, vs.service_name, vs.service_style, 
      vs.is_enabled, vs.publish_status
    FROM vendor_services vs
    WHERE vs.vendor_id = $1
      AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic', 'center', 'clinic')
      AND vs.is_enabled = true
      AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
  `, [VENDOR_ID]);
  
  console.log(`Found ${atCenterServices.rows.length} at_center service(s) that match discovery criteria:`);
  atCenterServices.rows.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.service_name} (style: ${s.service_style}, enabled: ${s.is_enabled}, publish: ${s.publish_status})`);
  });
  if (atCenterServices.rows.length === 0) {
    console.log('❌ NO AT_CENTER SERVICES FOUND! This is likely the issue.');
  }
  console.log('');

  // 4. Test the actual discover-services query
  console.log('4. TESTING DISCOVER-SERVICES QUERY:');
  console.log('-'.repeat(80));
  const acceptableStyles = ['at_center', 'at_vendor', 'at_clinic', 'center', 'clinic'];
  const targetRoles = ['vet_clinic', 'veterinarian', 'vet'];
  
  const discoveryQuery = `
    SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config,
      COALESCE((SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true), 0) as service_count,
      COALESCE((SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)), 0) as availability_count
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    INNER JOIN vendor_services vs ON vs.vendor_id = v.id AND vs.vendor_id IS NOT NULL
    WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
      AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
      AND LOWER(r.name) NOT LIKE '%solo%'
      AND vs.service_style = ANY($1::text[])
      AND vs.is_enabled = true
      AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      AND vs.service_style != 'at_home'
      AND LOWER(r.name) = ANY($2::text[])
  `;
  
  const discoveryResult = await query(discoveryQuery, [acceptableStyles, targetRoles.map(r => r.toLowerCase())]);
  console.log(`Query returned ${discoveryResult.rows.length} vendor(s)`);
  
  const foundVendor = discoveryResult.rows.find(v => v.id === VENDOR_ID);
  if (foundVendor) {
    console.log('✅ VENDOR FOUND IN QUERY!');
    console.log(JSON.stringify({
      id: foundVendor.id,
      business_name: foundVendor.business_name,
      role_name: foundVendor.role_name,
      service_count: foundVendor.service_count,
      availability_count: foundVendor.availability_count
    }, null, 2));
  } else {
    console.log('❌ VENDOR NOT FOUND IN QUERY!');
    console.log('\nChecking why...');
    
    // Check each condition
    console.log('\n  a) Status check:');
    const statusCheck = await query(`
      SELECT status, is_active FROM vendors WHERE id = $1
    `, [VENDOR_ID]);
    console.log(`     status: ${statusCheck.rows[0]?.status}, is_active: ${statusCheck.rows[0]?.is_active}`);
    const statusOk = (statusCheck.rows[0]?.status === 'approved' || statusCheck.rows[0]?.status === 'active') && statusCheck.rows[0]?.is_active === true;
    console.log(`     ${statusOk ? '✅' : '❌'} Status condition: ${statusOk}`);
    
    console.log('\n  b) Business name check:');
    const businessNameCheck = await query(`
      SELECT business_name, TRIM(COALESCE(business_name, '')) as trimmed FROM vendors WHERE id = $1
    `, [VENDOR_ID]);
    const businessNameOk = businessNameCheck.rows[0]?.business_name != null && businessNameCheck.rows[0]?.trimmed !== '';
    console.log(`     business_name: "${businessNameCheck.rows[0]?.business_name}"`);
    console.log(`     ${businessNameOk ? '✅' : '❌'} Business name condition: ${businessNameOk}`);
    
    console.log('\n  c) Role check (not solo):');
    const roleCheck = await query(`
      SELECT r.name as role_name FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = $1
    `, [VENDOR_ID]);
    const roleName = roleCheck.rows[0]?.role_name?.toLowerCase() || '';
    const roleOk = !roleName.includes('solo');
    console.log(`     role_name: "${roleCheck.rows[0]?.role_name}"`);
    console.log(`     ${roleOk ? '✅' : '❌'} Role condition (not solo): ${roleOk}`);
    
    console.log('\n  d) Service style check:');
    const serviceStyleCheck = await query(`
      SELECT COUNT(*) as count FROM vendor_services vs
      WHERE vs.vendor_id = $1
        AND vs.service_style = ANY($2::text[])
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        AND vs.service_style != 'at_home'
    `, [VENDOR_ID, acceptableStyles]);
    const serviceStyleOk = parseInt(serviceStyleCheck.rows[0]?.count || '0') > 0;
    console.log(`     Matching services: ${serviceStyleCheck.rows[0]?.count}`);
    console.log(`     ${serviceStyleOk ? '✅' : '❌'} Service style condition: ${serviceStyleOk}`);
    
    console.log('\n  e) Role name in target roles:');
    const roleMatchCheck = roleName && targetRoles.map(r => r.toLowerCase()).includes(roleName);
    console.log(`     role_name: "${roleName}"`);
    console.log(`     targetRoles: ${JSON.stringify(targetRoles.map(r => r.toLowerCase()))}`);
    console.log(`     ${roleMatchCheck ? '✅' : '❌'} Role match condition: ${roleMatchCheck}`);
  }
  console.log('');

  // 5. Check vendor availability
  console.log('5. VENDOR AVAILABILITY (vendor_availability_v2):');
  console.log('-'.repeat(80));
  const availability = await query(`
    SELECT 
      va.id, va.vendor_id, va.day_of_week, va.is_available,
      va.service_styles, va.service_style, va.service_type,
      va.time_window_start, va.time_window_end
    FROM vendor_availability_v2 va
    WHERE va.vendor_id = $1 OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = (SELECT phone FROM vendors WHERE id = $1))
    ORDER BY va.day_of_week
  `, [VENDOR_ID]);
  
  console.log(`Found ${availability.rows.length} availability record(s):`);
  availability.rows.forEach((a, i) => {
    console.log(`\n  ${i + 1}. Day ${a.day_of_week}, available: ${a.is_available}, styles: ${JSON.stringify(a.service_styles || [a.service_style].filter(Boolean))}`);
  });
  if (availability.rows.length === 0) {
    console.log('⚠️  No availability records found (this is optional for at_center)');
  }
  console.log('');

  // 6. Summary
  console.log('='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  const hasAtCenterService = atCenterServices.rows.length > 0;
  const vendorStatusOk = (vendor.status === 'approved' || vendor.status === 'active') && vendor.is_active === true;
  const businessNameOk = vendor.business_name != null && vendor.business_name.trim() !== '';
  const roleOk = vendor.role_name && !vendor.role_name.toLowerCase().includes('solo');
  const roleMatchOk = vendor.role_name && targetRoles.map(r => r.toLowerCase()).includes(vendor.role_name.toLowerCase());
  
  console.log(`✅ Vendor exists: Yes`);
  console.log(`${vendorStatusOk ? '✅' : '❌'} Status & active: ${vendorStatusOk}`);
  console.log(`${businessNameOk ? '✅' : '❌'} Business name: ${businessNameOk}`);
  console.log(`${roleOk ? '✅' : '❌'} Role (not solo): ${roleOk}`);
  console.log(`${roleMatchOk ? '✅' : '❌'} Role matches target: ${roleMatchOk}`);
  console.log(`${hasAtCenterService ? '✅' : '❌'} Has at_center service: ${hasAtCenterService}`);
  
  if (!hasAtCenterService) {
    console.log('\n❌ ISSUE FOUND: Vendor does not have an enabled, published service with service_style = at_center');
    console.log('   Fix: Create or update a vendor_service with:');
    console.log('   - service_style IN (\'at_center\', \'at_vendor\', \'at_clinic\', \'center\', \'clinic\')');
    console.log('   - is_enabled = true');
    console.log('   - publish_status IN (\'published\', \'auto_published\') OR publish_status IS NULL');
  } else if (!vendorStatusOk) {
    console.log('\n❌ ISSUE FOUND: Vendor status or is_active is incorrect');
  } else if (!roleMatchOk) {
    console.log('\n❌ ISSUE FOUND: Vendor role does not match target roles');
  } else {
    console.log('\n✅ All checks passed! Vendor should appear in discovery.');
    console.log('   If it still doesn\'t appear, check CloudWatch logs for roleConfigAllowsStyle filtering.');
  }

  await pool.end();
}

debugVendor().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

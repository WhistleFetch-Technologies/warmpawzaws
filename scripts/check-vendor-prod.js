/**
 * Check if vendor exists in production RDS
 * Vendor: Friendly tails pet hospital (863d5f9f-2cec-4792-9ea8-64c98059061c)
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Please set DATABASE_URL environment variable.');
  console.error('   Example: $env:DATABASE_URL="postgresql://user:pass@host:5432/db" node scripts/check-vendor-prod.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const VENDOR_ID = '863d5f9f-2cec-4792-9ea8-64c98059061c';
const VENDOR_NAME = 'Friendly tails pet hospital';

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function checkVendor() {
  console.log('='.repeat(80));
  console.log('CHECKING VENDOR IN PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}`);
  console.log(`Vendor Name: ${VENDOR_NAME}\n`);

  // 1. Check vendor exists
  console.log('1. VENDOR BASIC INFO:');
  console.log('-'.repeat(80));
  const vendorInfo = await query(`
    SELECT 
      v.id, v.business_name, v.status, v.is_active, v.role_id, v.category,
      v.vendor_type, v.latitude, v.longitude, v.phone, v.email,
      r.name as role_name, r.display_name as role_display_name, r.config as role_config
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
    WHERE v.id = $1 OR LOWER(v.business_name) LIKE LOWER($2)
    ORDER BY v.id = $1 DESC
    LIMIT 5
  `, [VENDOR_ID, `%${VENDOR_NAME.toLowerCase()}%`]);
  
  if (vendorInfo.rows.length === 0) {
    console.log('❌ VENDOR NOT FOUND!');
    await pool.end();
    return;
  }
  
  const vendor = vendorInfo.rows.find(v => v.id === VENDOR_ID) || vendorInfo.rows[0];
  console.log(JSON.stringify(vendor, null, 2));
  console.log('');

  // 2. Check vendor services
  console.log('2. VENDOR SERVICES:');
  console.log('-'.repeat(80));
  const services = await query(`
    SELECT 
      vs.id, vs.service_id, vs.service_name, vs.service_style, 
      vs.is_enabled, vs.publish_status, vs.category
    FROM vendor_services vs
    WHERE vs.vendor_id = $1
    ORDER BY vs.created_at DESC
  `, [vendor.id]);
  
  console.log(`Found ${services.rows.length} service(s):`);
  services.rows.forEach((s, i) => {
    console.log(`\nService ${i + 1}:`);
    console.log(JSON.stringify(s, null, 2));
  });
  console.log('');

  // 3. Check at_center services
  console.log('3. AT_CENTER SERVICES:');
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
  `, [vendor.id]);
  
  console.log(`Found ${atCenterServices.rows.length} at_center service(s):`);
  atCenterServices.rows.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.service_name} (style: ${s.service_style}, enabled: ${s.is_enabled}, publish: ${s.publish_status})`);
  });
  console.log('');

  // 4. Test the exact discover-services query
  console.log('4. TESTING DISCOVER-SERVICES QUERY:');
  console.log('-'.repeat(80));
  const acceptableStyles = ['at_center', 'at_vendor', 'at_clinic'];
  const targetRoles = ['vet_clinic', 'veterinarian', 'vet'];
  
  const discoveryQuery = `
    SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name, r.config as role_config,
      COALESCE((SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true), 0) as service_count
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
      AND v.id = $3
  `;
  
  const discoveryResult = await query(discoveryQuery, [
    acceptableStyles, 
    targetRoles.map(r => r.toLowerCase()),
    vendor.id
  ]);
  
  console.log(`Query returned ${discoveryResult.rows.length} vendor(s)`);
  if (discoveryResult.rows.length > 0) {
    console.log('✅ VENDOR MATCHES DISCOVERY QUERY!');
    console.log(JSON.stringify({
      id: discoveryResult.rows[0].id,
      business_name: discoveryResult.rows[0].business_name,
      role_name: discoveryResult.rows[0].role_name,
      service_count: discoveryResult.rows[0].service_count
    }, null, 2));
  } else {
    console.log('❌ VENDOR DOES NOT MATCH DISCOVERY QUERY!');
    console.log('\nChecking each condition...');
    
    // Check each condition individually
    const checks = [
      { name: 'Status & Active', query: `SELECT status, is_active FROM vendors WHERE id = $1`, params: [vendor.id] },
      { name: 'Business Name', query: `SELECT business_name, TRIM(COALESCE(business_name, '')) as trimmed FROM vendors WHERE id = $1`, params: [vendor.id] },
      { name: 'Role (not solo)', query: `SELECT r.name FROM vendors v LEFT JOIN roles r ON v.role_id = r.id WHERE v.id = $1`, params: [vendor.id] },
      { name: 'Service Style', query: `SELECT COUNT(*) as count FROM vendor_services vs WHERE vs.vendor_id = $1 AND vs.service_style = ANY($2::text[]) AND vs.is_enabled = true AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`, params: [vendor.id, acceptableStyles] },
      { name: 'Role Match', query: `SELECT r.name FROM vendors v LEFT JOIN roles r ON v.role_id = r.id WHERE v.id = $1 AND LOWER(r.name) = ANY($2::text[])`, params: [vendor.id, targetRoles.map(r => r.toLowerCase())] },
    ];
    
    for (const check of checks) {
      try {
        const result = await query(check.query, check.params);
        console.log(`\n  ${check.name}:`);
        console.log(`    Result: ${JSON.stringify(result.rows[0] || {})}`);
      } catch (err) {
        console.log(`\n  ${check.name}: ERROR - ${err.message}`);
      }
    }
  }
  console.log('');

  // 5. Check discoverable roles
  console.log('5. DISCOVERABLE ROLES CHECK:');
  console.log('-'.repeat(80));
  const discoverableRoles = await query(`
    SELECT DISTINCT r.name AS role_name
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    WHERE (v.status = 'approved' OR v.status = 'active')
      AND v.is_active = true
      AND EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.vendor_id = v.id
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
      )
    ORDER BY r.name
  `);
  
  const roleNames = discoverableRoles.rows.map(r => r.role_name).filter(Boolean);
  console.log(`Found ${roleNames.length} discoverable role(s):`);
  console.log(roleNames.join(', '));
  
  const hasVetClinic = roleNames.some(r => r.toLowerCase() === 'vet_clinic');
  console.log(`\n  vet_clinic in discoverable roles: ${hasVetClinic ? '✅ YES' : '❌ NO'}`);
  console.log('');

  await pool.end();
}

checkVendor().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

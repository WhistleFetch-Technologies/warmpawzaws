#!/usr/bin/env node
/**
 * Investigate Tele Vendor Issue
 * Checks vendor availability, services, and coordinates
 */

const { Pool } = require('pg');

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'warmpawz',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false,
  };
};

async function investigate() {
  const pool = new Pool(getDbConfig());
  const vendorId = '96cb1237-0690-406b-8817-825107aba628';
  const customerPhone = '9326977987';
  
  try {
    console.log('🔍 Investigating Tele Vendor Issue\n');
    console.log('='.repeat(60));
    
    // 1. Check vendor basic info
    console.log('\n1️⃣ VENDOR BASIC INFO:');
    const vendorInfo = await pool.query(
      `SELECT id, business_name, status, is_active, vendor_type, 
              latitude, longitude, role_id
       FROM vendors 
       WHERE id = $1`,
      [vendorId]
    );
    
    if (vendorInfo.rows.length === 0) {
      console.log('❌ Vendor not found!');
      return;
    }
    
    const vendor = vendorInfo.rows[0];
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Business Name: ${vendor.business_name}`);
    console.log(`   Status: ${vendor.status}`);
    console.log(`   Is Active: ${vendor.is_active}`);
    console.log(`   Vendor Type: ${vendor.vendor_type}`);
    console.log(`   Latitude: ${vendor.latitude}`);
    console.log(`   Longitude: ${vendor.longitude}`);
    console.log(`   Role ID: ${vendor.role_id}`);
    
    // 2. Check vendor services for tele
    console.log('\n2️⃣ VENDOR SERVICES (tele):');
    const teleServices = await pool.query(
      `SELECT vs.id, vs.service_id, vs.service_name, vs.service_style,
              vs.price, vs.is_enabled, vs.publish_status, vs.category
       FROM vendor_services vs
       WHERE vs.vendor_id = $1 
         AND vs.service_style = 'tele'
       ORDER BY vs.service_name`,
      [vendorId]
    );
    
    console.log(`   Found ${teleServices.rows.length} tele service(s):`);
    teleServices.rows.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.service_name} (${s.service_style})`);
      console.log(`      - ID: ${s.id}`);
      console.log(`      - Enabled: ${s.is_enabled}`);
      console.log(`      - Publish Status: ${s.publish_status}`);
      console.log(`      - Price: ${s.price}`);
    });
    
    // 3. Check vendor availability for tele
    console.log('\n3️⃣ VENDOR AVAILABILITY (tele):');
    const availability = await pool.query(
      `SELECT va.*
       FROM vendor_availability_v2 va
       WHERE va.vendor_id = $1
       ORDER BY va.day_of_week`,
      [vendorId]
    );
    
    console.log(`   Found ${availability.rows.length} availability record(s):`);
    availability.rows.forEach((a, i) => {
      console.log(`   ${i + 1}. Day: ${a.day_of_week}`);
      console.log(`      - Start: ${a.start_time || a.time_window_start}`);
      console.log(`      - End: ${a.end_time || a.time_window_end}`);
      console.log(`      - Is Available: ${a.is_available}`);
    });
    
    // 4. Check customer coordinates
    console.log('\n4️⃣ CUSTOMER COORDINATES:');
    const customer = await pool.query(
      `SELECT c.id, c.phone, c.full_name,
              ca.coordinates->>'lat' as latitude, 
              ca.coordinates->>'lng' as longitude, 
              ca.address_line1, ca.is_default
       FROM customers c
       LEFT JOIN customer_addresses ca ON ca.customer_id = c.id AND ca.is_default = true
       WHERE c.phone = $1`,
      [customerPhone]
    );
    
    if (customer.rows.length > 0) {
      const cust = customer.rows[0];
      console.log(`   Customer: ${cust.full_name || 'N/A'} (${cust.phone})`);
      console.log(`   Default Address Latitude: ${cust.latitude || 'NULL'}`);
      console.log(`   Default Address Longitude: ${cust.longitude || 'NULL'}`);
      console.log(`   Address: ${cust.address_line1 || 'NULL'}`);
    } else {
      console.log(`   ❌ Customer not found with phone: ${customerPhone}`);
    }
    
    // 5. Check role config
    console.log('\n5️⃣ ROLE CONFIG:');
    const role = await pool.query(
      `SELECT id, name, display_name, config
       FROM roles
       WHERE id = $1`,
      [vendor.role_id]
    );
    
    if (role.rows.length > 0) {
      const r = role.rows[0];
      console.log(`   Role: ${r.display_name} (${r.name})`);
      const config = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
      if (config.serviceStyles) {
        console.log(`   Service Styles (business): ${JSON.stringify(config.serviceStyles.business || [])}`);
        console.log(`   Service Styles (selected): ${JSON.stringify(config.serviceStyles.selected || [])}`);
      }
    }
    
    // 6. Simulate the query that should find this vendor
    console.log('\n6️⃣ SIMULATING BY-STYLE QUERY:');
    console.log('   Query parameters:');
    console.log(`   - style: tele`);
    console.log(`   - category: vet`);
    console.log(`   - roleId: veterinarian`);
    console.log(`   - customerPhone: ${customerPhone}`);
    
    // Check if vendor matches the query criteria
    const targetRoles = ['veterinarian', 'vet_clinic', 'vet_solo'];
    const roleMatch = role.rows.length > 0 && (
      targetRoles.includes(role.rows[0].name) ||
      targetRoles.some(tr => role.rows[0].name.toLowerCase().includes(tr.toLowerCase()))
    );
    
    console.log(`\n   ✅ Vendor Status: ${vendor.status === 'approved' ? 'APPROVED' : 'NOT APPROVED'}`);
    console.log(`   ✅ Vendor Active: ${vendor.is_active ? 'YES' : 'NO'}`);
    console.log(`   ✅ Has Tele Services: ${teleServices.rows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`   ✅ Has Availability: ${availability.rows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`   ✅ Role Match: ${roleMatch ? 'YES' : 'NO'}`);
    console.log(`   ✅ Has Coordinates: ${vendor.latitude && vendor.longitude ? 'YES' : 'NO'}`);
    
    // 7. Check what the actual query would return
    console.log('\n7️⃣ ACTUAL QUERY CHECK:');
    const acceptableStyles = ['tele', 'video_consultation'];
    const queryCheck = await pool.query(
      `SELECT DISTINCT ON (v.id)
         v.id AS vendor_id, v.business_name, v.owner_name, v.phone,
         v.address, v.city, v.latitude, v.longitude, v.metadata,
         v.profile_photo_url, v.vendor_type,
         r.name AS role_name, r.display_name AS role_display_name,
         r.config AS role_config,
         COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) AS avg_rating,
         COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id), 0) AS review_count
       FROM vendors v
       LEFT JOIN roles r ON v.role_id = r.id
       INNER JOIN vendor_services vs ON vs.vendor_id = v.id
       WHERE v.id = $1
         AND v.is_active = true
         AND (v.status IN ('approved','active')
              OR (v.status = 'pending' AND v.vendor_type = 'solo'))
         AND vs.service_style = ANY($2::text[])
         AND vs.is_enabled = true
         AND (vs.publish_status IN ('published','auto_published')
              OR vs.publish_status IS NULL)`,
      [vendorId, acceptableStyles]
    );
    
    console.log(`   Query returned ${queryCheck.rows.length} row(s)`);
    if (queryCheck.rows.length > 0) {
      const result = queryCheck.rows[0];
      console.log(`   ✅ Vendor would be found by query`);
      console.log(`      - Role: ${result.role_name}`);
      console.log(`      - Status: ${vendor.status}`);
    } else {
      console.log(`   ❌ Vendor would NOT be found by query`);
      console.log(`   Checking why...`);
      
      // Check each condition
      const statusCheck = vendor.status === 'approved' || vendor.status === 'active' || 
                         (vendor.status === 'pending' && vendor.vendor_type === 'solo');
      console.log(`      - Status check: ${statusCheck ? 'PASS' : 'FAIL'} (status: ${vendor.status}, type: ${vendor.vendor_type})`);
      console.log(`      - Active check: ${vendor.is_active ? 'PASS' : 'FAIL'}`);
      console.log(`      - Has tele services: ${teleServices.rows.length > 0 ? 'PASS' : 'FAIL'}`);
      if (teleServices.rows.length > 0) {
        const enabledTele = teleServices.rows.filter(s => s.is_enabled);
        const publishedTele = enabledTele.filter(s => 
          s.publish_status === 'published' || 
          s.publish_status === 'auto_published' || 
          s.publish_status === null
        );
        console.log(`      - Tele services enabled: ${enabledTele.length > 0 ? 'PASS' : 'FAIL'}`);
        console.log(`      - Tele services published: ${publishedTele.length > 0 ? 'PASS' : 'FAIL'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

investigate();

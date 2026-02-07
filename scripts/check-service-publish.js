/**
 * Diagnostic script to check why service publishing fails
 * Usage: node check-service-publish.js <serviceId> <vendorId>
 */

const { Pool } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'warmpawz-dev-db.cluster-cqgqgqgqgqgq.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz_dev',
  user: 'warmpawz_admin',
  password: process.env.DB_PASSWORD || 'Warmpawz@2024',
  ssl: {
    rejectUnauthorized: false
  }
};

const serviceId = process.argv[2] || '8e5366eb-2a85-4d75-aead-f98de00db021';
const vendorId = process.argv[3] || '0c0df45b-6d33-406f-a38c-8d5fe279c4f5';

async function checkService() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    console.log(`\n🔍 Checking service: ${serviceId}`);
    console.log(`🔍 For vendor: ${vendorId}\n`);
    
    // Check 1: Does service exist in vendor_services by id?
    const checkById = await pool.query(
      `SELECT id, vendor_id, service_id, service_name, service_style, is_enabled, publish_status, created_at
       FROM vendor_services 
       WHERE id = $1::uuid`,
      [serviceId]
    );
    
    console.log(`\n1. Check by vendor_services.id = '${serviceId}':`);
    if (checkById.rows.length > 0) {
      const svc = checkById.rows[0];
      console.log(`   ✅ Found service:`);
      console.log(`      - id: ${svc.id}`);
      console.log(`      - vendor_id: ${svc.vendor_id}`);
      console.log(`      - service_id: ${svc.service_id}`);
      console.log(`      - service_name: ${svc.service_name}`);
      console.log(`      - service_style: ${svc.service_style}`);
      console.log(`      - is_enabled: ${svc.is_enabled}`);
      console.log(`      - publish_status: ${svc.publish_status}`);
      console.log(`      - Vendor match: ${svc.vendor_id === vendorId ? '✅ YES' : '❌ NO'}`);
      
      if (svc.vendor_id !== vendorId) {
        console.log(`\n   ⚠️  ISSUE: Service belongs to vendor ${svc.vendor_id}, not ${vendorId}`);
      }
    } else {
      console.log(`   ❌ Service not found by id`);
    }
    
    // Check 2: Does service exist in vendor_services by service_id?
    const checkByServiceId = await pool.query(
      `SELECT id, vendor_id, service_id, service_name, service_style, is_enabled, publish_status
       FROM vendor_services 
       WHERE service_id = $1::uuid AND vendor_id = $2::uuid`,
      [serviceId, vendorId]
    );
    
    console.log(`\n2. Check by vendor_services.service_id = '${serviceId}' AND vendor_id = '${vendorId}':`);
    if (checkByServiceId.rows.length > 0) {
      const svc = checkByServiceId.rows[0];
      console.log(`   ✅ Found service:`);
      console.log(`      - vendor_services.id: ${svc.id} (use this for PUT requests)`);
      console.log(`      - vendor_id: ${svc.vendor_id}`);
      console.log(`      - service_id: ${svc.service_id}`);
      console.log(`      - service_name: ${svc.service_name}`);
    } else {
      console.log(`   ❌ Service not found by service_id`);
    }
    
    // Check 3: List all services for this vendor
    const allVendorServices = await pool.query(
      `SELECT id, service_id, service_name, service_style, is_enabled, publish_status
       FROM vendor_services 
       WHERE vendor_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 10`,
      [vendorId]
    );
    
    console.log(`\n3. All services for vendor ${vendorId} (last 10):`);
    if (allVendorServices.rows.length > 0) {
      allVendorServices.rows.forEach((svc, idx) => {
        console.log(`   ${idx + 1}. id=${svc.id}, service_id=${svc.service_id}, name=${svc.service_name}, style=${svc.service_style}, enabled=${svc.is_enabled}, published=${svc.publish_status}`);
      });
    } else {
      console.log(`   ❌ No services found for this vendor`);
    }
    
    // Check 4: Check if service exists in service_catalog
    const catalogCheck = await pool.query(
      `SELECT id, service_id, service_name, service_style
       FROM service_catalog 
       WHERE id = $1::uuid OR service_id = $1::text`,
      [serviceId]
    );
    
    console.log(`\n4. Check in service_catalog:`);
    if (catalogCheck.rows.length > 0) {
      const svc = catalogCheck.rows[0];
      console.log(`   ✅ Found in catalog:`);
      console.log(`      - id: ${svc.id}`);
      console.log(`      - service_id: ${svc.service_id}`);
      console.log(`      - service_name: ${svc.service_name}`);
      console.log(`   ⚠️  Service exists in catalog but may not be added to vendor`);
    } else {
      console.log(`   ❌ Service not found in catalog`);
    }
    
    console.log(`\n✅ Diagnostic complete\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkService();

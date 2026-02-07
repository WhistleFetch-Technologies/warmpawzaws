/**
 * Diagnostic script to check vendor service in database
 * Usage: node scripts/check-vendor-service.js <serviceId> <vendorId>
 */

const { Pool } = require('pg');

// Database connection from environment or defaults
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'warmpawz';
const DB_USER = process.env.DB_USER || 'warmpawz_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Warmpawz2026';

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkService(serviceId, vendorId) {
  console.log(`\n🔍 Checking Service ID: ${serviceId}`);
  console.log(`🔍 For Vendor ID: ${vendorId}\n`);

  try {
    // 1. Check if service exists in vendor_services by id
    console.log('1️⃣ Checking vendor_services by id...');
    const vsById = await pool.query(
      'SELECT id, vendor_id, service_id, service_name, service_style, is_enabled, publish_status, created_at FROM vendor_services WHERE id = $1::uuid',
      [serviceId]
    );
    
    if (vsById.rows.length > 0) {
      console.log('✅ Found in vendor_services by id:');
      console.log(JSON.stringify(vsById.rows[0], null, 2));
      
      if (vsById.rows[0].vendor_id !== vendorId) {
        console.log(`\n⚠️ WARNING: Service belongs to vendor ${vsById.rows[0].vendor_id}, not ${vendorId}`);
      } else {
        console.log(`\n✅ Service belongs to the correct vendor`);
      }
    } else {
      console.log('❌ Not found in vendor_services by id');
    }

    // 2. Check if service exists in vendor_services by service_id
    console.log('\n2️⃣ Checking vendor_services by service_id...');
    const vsByServiceId = await pool.query(
      'SELECT id, vendor_id, service_id, service_name, service_style, is_enabled, publish_status FROM vendor_services WHERE service_id = $1::uuid',
      [serviceId]
    );
    
    if (vsByServiceId.rows.length > 0) {
      console.log(`✅ Found ${vsByServiceId.rows.length} service(s) in vendor_services by service_id:`);
      vsByServiceId.rows.forEach((row, idx) => {
        console.log(`\n  Service ${idx + 1}:`);
        console.log(JSON.stringify(row, null, 2));
        if (row.vendor_id !== vendorId) {
          console.log(`  ⚠️ WARNING: Belongs to vendor ${row.vendor_id}, not ${vendorId}`);
        }
      });
    } else {
      console.log('❌ Not found in vendor_services by service_id');
    }

    // 3. Check if service exists in service_catalog
    console.log('\n3️⃣ Checking service_catalog...');
    const catalogById = await pool.query(
      'SELECT id, service_id, service_name, display_name, status, publish_status FROM service_catalog WHERE id = $1::uuid',
      [serviceId]
    );
    
    if (catalogById.rows.length > 0) {
      console.log('✅ Found in service_catalog by id:');
      console.log(JSON.stringify(catalogById.rows[0], null, 2));
    } else {
      console.log('❌ Not found in service_catalog by id');
    }

    // 4. Check all vendor_services for this vendor
    console.log(`\n4️⃣ Checking all vendor_services for vendor ${vendorId}...`);
    const allVendorServices = await pool.query(
      'SELECT id, service_id, service_name, service_style, is_enabled, publish_status, created_at FROM vendor_services WHERE vendor_id = $1::uuid ORDER BY created_at DESC LIMIT 10',
      [vendorId]
    );
    
    console.log(`✅ Found ${allVendorServices.rows.length} service(s) for this vendor:`);
    allVendorServices.rows.forEach((row, idx) => {
      console.log(`\n  Service ${idx + 1}:`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Service ID: ${row.service_id}`);
      console.log(`    Name: ${row.service_name}`);
      console.log(`    Style: ${row.service_style}`);
      console.log(`    Enabled: ${row.is_enabled}`);
      console.log(`    Status: ${row.publish_status}`);
    });

    // 5. Check schema for vendor_services table
    console.log('\n5️⃣ Checking vendor_services table schema...');
    const schema = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'vendor_services' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ vendor_services table columns:');
    schema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 6. Check constraints
    console.log('\n6️⃣ Checking constraints...');
    const constraints = await pool.query(`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'vendor_services'
    `);
    
    console.log('✅ Constraints:');
    constraints.rows.forEach(con => {
      console.log(`  - ${con.constraint_name}: ${con.constraint_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const serviceId = process.argv[2] || '69e2d31d-bbf8-4b31-9327-1d1ce82b564c';
const vendorId = process.argv[3] || '0c0df45b-6d33-406f-a38c-8d5fe279c4f5';

checkService(serviceId, vendorId).catch(console.error);

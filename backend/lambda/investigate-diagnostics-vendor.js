const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env.local') });

// Database connection configuration
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'warmpawz',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    config.ssl = false;
  }

  return config;
};

const pool = new Pool(getDbConfig());

async function investigateDiagnosticsVendor() {
  const vendorId = '061d5153-4c4b-4e37-a9b5-ddb0dbc75da0';
  
  console.log('🔍 Investigating Diagnostics Vendor');
  console.log('=====================================\n');
  console.log(`Vendor ID: ${vendorId}\n`);

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // 1️⃣ VENDOR INFO
    console.log('1️⃣ VENDOR INFO:');
    console.log('─'.repeat(100));
    const vendorResult = await client.query(
      `SELECT id, business_name, owner_name, role_id, status, is_active, category
       FROM vendors WHERE id = $1`,
      [vendorId]
    );
    if (vendorResult.rows.length > 0) {
      const vendor = vendorResult.rows[0];
      console.log(`   Business Name: ${vendor.business_name}`);
      console.log(`   Owner Name: ${vendor.owner_name}`);
      console.log(`   Role ID: ${vendor.role_id}`);
      console.log(`   Status: ${vendor.status}`);
      console.log(`   Is Active: ${vendor.is_active}`);
      console.log(`   Category: ${vendor.category}`);
    } else {
      console.log('   ❌ Vendor not found!');
      client.release();
      await pool.end();
      return;
    }
    console.log('');

    // 2️⃣ VENDOR SERVICES (what customer endpoint sees)
    console.log('2️⃣ VENDOR SERVICES (from vendor_services table):');
    console.log('─'.repeat(100));
    const servicesResult = await client.query(
      `SELECT 
        vs.id,
        vs.service_id,
        vs.vendor_id,
        vs.service_name,
        vs.service_style,
        vs.price,
        vs.duration_minutes,
        vs.is_enabled,
        vs.publish_status,
        vs.created_at,
        sc.name as catalog_service_name,
        sc.id as catalog_service_id
       FROM vendor_services vs
       LEFT JOIN service_catalog sc ON vs.service_id = sc.id
       WHERE vs.vendor_id = $1
       ORDER BY vs.created_at DESC`,
      [vendorId]
    );
    
    console.log(`   Total vendor_services: ${servicesResult.rows.length}`);
    servicesResult.rows.forEach((s, idx) => {
      console.log(`\n   ${idx + 1}. Service: ${s.service_name || s.catalog_service_name || 'N/A'}`);
      console.log(`      ID: ${s.id}`);
      console.log(`      Service ID (catalog): ${s.service_id}`);
      console.log(`      Service Style: ${s.service_style}`);
      console.log(`      Price: ₹${s.price}`);
      console.log(`      Duration: ${s.duration_minutes} min`);
      console.log(`      Is Enabled: ${s.is_enabled}`);
      console.log(`      Publish Status: ${s.publish_status || 'NULL'}`);
      console.log(`      Created: ${s.created_at}`);
    });
    console.log('');

    // 3️⃣ DIAGNOSTICS TESTS (what vendor endpoint might be looking for)
    console.log('3️⃣ DIAGNOSTICS TESTS (checking for diagnostics_tests table):');
    console.log('─'.repeat(100));
    
    // Check if diagnostics_tests table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'diagnostics_tests'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      const testsResult = await client.query(
        `SELECT 
          id,
          vendor_id,
          test_name,
          test_code,
          category,
          price,
          duration_minutes,
          is_published,
          is_active,
          created_at
         FROM diagnostics_tests
         WHERE vendor_id = $1
         ORDER BY created_at DESC`,
        [vendorId]
      );
      
      console.log(`   Total diagnostics_tests: ${testsResult.rows.length}`);
      if (testsResult.rows.length > 0) {
        testsResult.rows.forEach((t, idx) => {
          console.log(`\n   ${idx + 1}. Test: ${t.test_name || 'N/A'}`);
          console.log(`      ID: ${t.id}`);
          console.log(`      Test Code: ${t.test_code || 'N/A'}`);
          console.log(`      Category: ${t.category || 'N/A'}`);
          console.log(`      Price: ₹${t.price}`);
          console.log(`      Duration: ${t.duration_minutes} min`);
          console.log(`      Is Published: ${t.is_published}`);
          console.log(`      Is Active: ${t.is_active}`);
        });
      } else {
        console.log('   ⚠️  No diagnostics_tests found for this vendor');
      }
    } else {
      console.log('   ⚠️  diagnostics_tests table does not exist');
    }
    console.log('');

    // 4️⃣ CHECK ALL TABLES WITH "diagnostic" IN NAME
    console.log('4️⃣ ALL TABLES WITH "diagnostic" IN NAME:');
    console.log('─'.repeat(100));
    const diagnosticTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%diagnostic%'
      ORDER BY table_name
    `);
    
    if (diagnosticTables.rows.length > 0) {
      diagnosticTables.rows.forEach(t => {
        console.log(`   - ${t.table_name}`);
      });
    } else {
      console.log('   ⚠️  No tables with "diagnostic" in name found');
    }
    console.log('');

    // 5️⃣ CHECK SERVICE CATALOG FOR DIAGNOSTICS SERVICES
    console.log('5️⃣ SERVICE CATALOG (diagnostics-related services):');
    console.log('─'.repeat(100));
    const catalogResult = await client.query(
      `SELECT id, name, category, service_type, is_active
       FROM service_catalog
       WHERE category LIKE '%diagnostic%' OR name LIKE '%test%' OR name LIKE '%diagnostic%'
       ORDER BY name
       LIMIT 20`
    );
    
    console.log(`   Found ${catalogResult.rows.length} catalog services`);
    catalogResult.rows.forEach((c, idx) => {
      console.log(`   ${idx + 1}. ${c.name} (ID: ${c.id}, Category: ${c.category || 'N/A'})`);
    });
    console.log('');

    // 6️⃣ CHECK ROLE CONFIGURATION
    console.log('6️⃣ ROLE CONFIGURATION:');
    console.log('─'.repeat(100));
    const roleResult = await client.query(
      `SELECT r.id, r.name, r.display_name, r.config
       FROM roles r
       INNER JOIN vendors v ON v.role_id = r.id
       WHERE v.id = $1`,
      [vendorId]
    );
    
    if (roleResult.rows.length > 0) {
      const role = roleResult.rows[0];
      console.log(`   Role Name: ${role.name}`);
      console.log(`   Display Name: ${role.display_name}`);
      const config = typeof role.config === 'string' ? JSON.parse(role.config) : role.config;
      console.log(`   Config Keys: ${Object.keys(config || {}).join(', ')}`);
      if (config?.capabilities) {
        console.log(`   Capabilities: ${JSON.stringify(config.capabilities)}`);
      }
    }
    console.log('');

    // 7️⃣ COMPARISON: What customer endpoint sees vs vendor endpoint
    console.log('7️⃣ COMPARISON SUMMARY:');
    console.log('─'.repeat(100));
    console.log(`   Customer endpoint (/customer/services):`);
    console.log(`   - Returns ${servicesResult.rows.length} services from vendor_services table`);
    console.log(`   - Services: ${servicesResult.rows.map(s => s.service_name || s.catalog_service_name).join(', ')}`);
    console.log('');
    console.log(`   Vendor endpoint (/vendor/:vendorId/diagnostics/tests):`);
    if (tableCheck.rows[0].exists) {
      const testsCount = await client.query(
        `SELECT COUNT(*) as count FROM diagnostics_tests WHERE vendor_id = $1`,
        [vendorId]
      );
      console.log(`   - Looking in diagnostics_tests table`);
      console.log(`   - Found ${testsCount.rows[0].count} tests`);
      console.log(`   - ⚠️  Mismatch: vendor_services has data but diagnostics_tests is empty`);
    } else {
      console.log(`   - ⚠️  diagnostics_tests table does not exist`);
      console.log(`   - Endpoint might be looking for wrong table or wrong data structure`);
    }

    client.release();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n✨ Investigation complete!');
  }
}

investigateDiagnosticsVendor();

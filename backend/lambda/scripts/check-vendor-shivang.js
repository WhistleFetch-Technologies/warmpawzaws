const { query } = require('../src/database/rds-connection');

(async () => {
  try {
    console.log('🔍 Searching for vendor with name containing "Shivang" or phone "98765 42310"...\n');
    
    // Search for vendor
    const vendorResult = await query(`
      SELECT 
        v.id, 
        v.business_name, 
        v.owner_name, 
        v.phone, 
        v.status, 
        v.is_active, 
        v.vendor_type, 
        r.name as role_name, 
        r.display_name as role_display_name
      FROM vendors v 
      LEFT JOIN roles r ON v.role_id = r.id 
      WHERE 
        v.business_name ILIKE '%Shivang%' 
        OR v.owner_name ILIKE '%Shivang%' 
        OR v.phone LIKE '%98765%42310%' 
        OR v.phone LIKE '%42310%'
      ORDER BY v.created_at DESC 
      LIMIT 10
    `);
    
    console.log(`Found ${vendorResult.rows.length} vendor(s):\n`);
    console.log(JSON.stringify(vendorResult.rows, null, 2));
    
    if (vendorResult.rows.length > 0) {
      const vendor = vendorResult.rows[0];
      console.log(`\n🔍 Checking services for vendor ${vendor.id} (${vendor.business_name || vendor.owner_name})...\n`);
      
      // Check services
      const servicesResult = await query(`
        SELECT 
          vs.id, 
          vs.vendor_id, 
          vs.service_name, 
          vs.service_style, 
          vs.is_enabled, 
          vs.publish_status,
          vs.category
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
        ORDER BY vs.created_at DESC
      `, [vendor.id]);
      
      console.log(`Found ${servicesResult.rows.length} service(s):\n`);
      console.log(JSON.stringify(servicesResult.rows, null, 2));
      
      // Check tele services specifically
      const teleServices = servicesResult.rows.filter(s => 
        s.service_style === 'tele' || s.service_style === 'online'
      );
      console.log(`\n📞 Tele services: ${teleServices.length}`);
      if (teleServices.length > 0) {
        console.log(JSON.stringify(teleServices, null, 2));
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();

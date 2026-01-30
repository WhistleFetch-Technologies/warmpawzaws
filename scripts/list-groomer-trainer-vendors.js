/**
 * List Groomer and Trainer Vendors with Services
 * Queries database for vendors in groomer/trainer roles and their services
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function listGroomerTrainerVendors() {
  try {
    console.log('🔍 Querying groomer and trainer vendors...\n');

    // Query vendors with groomer or trainer roles
    const vendorQuery = `
      SELECT 
        v.id as vendor_id,
        v.business_name,
        v.phone,
        v.email,
        v.vendor_type,
        v.is_active,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        v.vendor_configuration,
        v.metadata
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE 
        (r.name ILIKE '%groomer%' OR r.name ILIKE '%trainer%' OR r.name ILIKE '%pet_groomer%' OR r.name ILIKE '%pet_trainer%')
        AND v.is_active = true
      ORDER BY r.name, v.business_name;
    `;

    const vendorResult = await pool.query(vendorQuery);
    const vendors = vendorResult.rows;

    console.log(`📊 Found ${vendors.length} active groomer/trainer vendors\n`);
    console.log('='.repeat(80));
    console.log('');

    if (vendors.length === 0) {
      console.log('⚠️  No groomer or trainer vendors found in the database.');
      await pool.end();
      return;
    }

    // For each vendor, get their services
    for (const vendor of vendors) {
      console.log(`\n🏢 VENDOR: ${vendor.business_name || 'Unnamed Vendor'}`);
      console.log(`   ID: ${vendor.vendor_id}`);
      console.log(`   Role: ${vendor.role_display_name || vendor.role_name || 'Unknown'}`);
      console.log(`   Phone: ${vendor.phone || 'N/A'}`);
      console.log(`   Type: ${vendor.vendor_type || 'N/A'}`);
      console.log(`   Configuration: ${vendor.vendor_configuration || 'N/A'}`);
      console.log('');

      // Get vendor services
      const servicesQuery = `
        SELECT 
          vs.id as vendor_service_id,
          vs.service_name,
          vs.service_style,
          vs.category,
          vs.sub_category,
          vs.price,
          vs.custom_price,
          vs.duration_minutes,
          vs.custom_duration,
          vs.is_enabled,
          vs.publish_status,
          vs.is_custom_service,
          vs.metadata,
          sc.service_name as catalog_service_name,
          sc.is_package as catalog_is_package
        FROM vendor_services vs
        LEFT JOIN service_catalog sc ON vs.service_id = sc.id OR vs.catalog_service_id = sc.id
        WHERE vs.vendor_id = $1
        ORDER BY vs.service_style, vs.service_name;
      `;

      const servicesResult = await pool.query(servicesQuery, [vendor.vendor_id]);
      const services = servicesResult.rows;

      if (services.length === 0) {
        console.log('   ⚠️  No services configured');
      } else {
        // Group services by style
        const servicesByStyle = {
          at_home: [],
          at_center: [],
          tele: [],
          unknown: []
        };

        services.forEach(service => {
          const style = service.service_style || 'unknown';
          if (servicesByStyle[style]) {
            servicesByStyle[style].push(service);
          } else {
            servicesByStyle.unknown.push(service);
          }
        });

        // Count enabled services
        const enabledServices = services.filter(s => s.is_enabled === true);
        const customServices = services.filter(s => s.is_custom_service === true);
        const packages = services.filter(s => 
          s.metadata?.isPackage === true || 
          s.catalog_is_package === true ||
          (s.metadata && typeof s.metadata === 'object' && 'isPackage' in s.metadata)
        );

        console.log(`   📦 Total Services: ${services.length}`);
        console.log(`   ✅ Enabled Services: ${enabledServices.length}`);
        console.log(`   🎨 Custom Services: ${customServices.length}`);
        console.log(`   📋 Packages: ${packages.length}`);
        console.log('');

        // Show services by style
        ['at_home', 'at_center', 'tele'].forEach(style => {
          const styleServices = servicesByStyle[style];
          if (styleServices.length > 0) {
            const styleLabel = style === 'at_home' ? '🏠 At Home' : 
                              style === 'at_center' ? '🏥 At Center' : 
                              '📱 Tele';
            console.log(`   ${styleLabel} Services (${styleServices.length}):`);
            
            styleServices.forEach(service => {
              const status = service.is_enabled ? '✅' : '❌';
              const custom = service.is_custom_service ? '🎨 CUSTOM' : '';
              const package = (service.metadata?.isPackage || service.catalog_is_package) ? '📋 PACKAGE' : '';
              const publishStatus = service.publish_status ? `[${service.publish_status}]` : '';
              
              console.log(`      ${status} ${service.service_name || service.catalog_service_name || 'Unnamed'} ${custom} ${package} ${publishStatus}`);
              console.log(`         Price: ₹${service.custom_price || service.price || 0} | Duration: ${service.custom_duration || service.duration_minutes || 0} min`);
              if (service.category) {
                console.log(`         Category: ${service.category}${service.sub_category ? ` > ${service.sub_category}` : ''}`);
              }
            });
            console.log('');
          }
        });

        // Show custom services separately if any
        if (customServices.length > 0) {
          console.log(`   🎨 Custom Services (${customServices.length}):`);
          customServices.forEach(service => {
            const status = service.is_enabled ? '✅' : '❌';
            console.log(`      ${status} ${service.service_name}`);
            console.log(`         Style: ${service.service_style || 'N/A'} | Price: ₹${service.custom_price || service.price || 0}`);
          });
          console.log('');
        }

        // Show packages separately if any
        if (packages.length > 0) {
          console.log(`   📋 Packages (${packages.length}):`);
          packages.forEach(service => {
            const status = service.is_enabled ? '✅' : '❌';
            const packageDetails = service.metadata?.packageDetails || {};
            console.log(`      ${status} ${service.service_name}`);
            console.log(`         Style: ${service.service_style || 'N/A'} | Price: ₹${service.custom_price || service.price || 0}`);
            if (packageDetails.sessionsPerDay || packageDetails.totalSessions) {
              console.log(`         Sessions: ${packageDetails.sessionsPerDay || 'N/A'}/day, Total: ${packageDetails.totalSessions || 'N/A'}`);
            }
          });
          console.log('');
        }
      }

      console.log('   ' + '-'.repeat(76));
    }

    // Summary
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    
    const totalServices = vendors.reduce((sum, v) => {
      // This would require another query, so we'll estimate from what we saw
      return sum;
    }, 0);

    const roleCounts = {};
    vendors.forEach(v => {
      const role = v.role_name || 'Unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    console.log(`Total Vendors: ${vendors.length}`);
    console.log('\nBy Role:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });

    console.log('\n✅ Query completed successfully!');

  } catch (error) {
    console.error('❌ Error querying database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the query
listGroomerTrainerVendors().catch(console.error);

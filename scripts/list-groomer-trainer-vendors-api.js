#!/usr/bin/env node
/**
 * List Groomer and Trainer Vendors with Services
 * Uses API endpoints to fetch vendor and service data
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function listGroomerTrainerVendors() {
  console.log('🔍 Fetching groomer and trainer vendors via API...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    // Step 1: Get all roles to find groomer/trainer role IDs
    console.log('📋 Step 1: Fetching roles...');
    const rolesResponse = await fetchWithRetry(`${API_BASE_URL}/config/roles`);
    
    if (!rolesResponse || !rolesResponse.roles) {
      console.log('⚠️  Could not fetch roles. Trying alternative approach...\n');
      console.log('💡 Please run the SQL query manually: scripts/list-groomer-trainer-vendors.sql\n');
      return;
    }

    const roles = rolesResponse.roles || [];
    const groomerTrainerRoles = roles.filter(r => 
      r.name && (
        r.name.toLowerCase().includes('groomer') ||
        r.name.toLowerCase().includes('trainer') ||
        r.name.toLowerCase().includes('pet_groomer') ||
        r.name.toLowerCase().includes('pet_trainer')
      )
    );

    console.log(`   Found ${groomerTrainerRoles.length} groomer/trainer roles:\n`);
    groomerTrainerRoles.forEach(role => {
      console.log(`   - ${role.display_name || role.name} (${role.id})`);
    });
    console.log('');

    if (groomerTrainerRoles.length === 0) {
      console.log('⚠️  No groomer or trainer roles found.');
      console.log('💡 Please run the SQL query manually: scripts/list-groomer-trainer-vendors.sql\n');
      return;
    }

    // Step 2: Get vendors for each role
    console.log('📋 Step 2: Fetching vendors for each role...\n');
    
    const allVendors = [];
    for (const role of groomerTrainerRoles) {
      try {
        // Try to get vendors via admin endpoint (if available)
        const vendorsResponse = await fetchWithRetry(`${API_BASE_URL}/admin/vendors?roleId=${role.id}`);
        if (vendorsResponse && vendorsResponse.vendors) {
          const vendors = vendorsResponse.vendors
            .filter(v => v.is_active !== false)
            .map(v => ({ ...v, role_name: role.name, role_display_name: role.display_name }));
          allVendors.push(...vendors);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not fetch vendors for role ${role.name}: ${error.message}`);
      }
    }

    if (allVendors.length === 0) {
      console.log('⚠️  No active vendors found via API.');
      console.log('💡 Please run the SQL query manually: scripts/list-groomer-trainer-vendors.sql\n');
      console.log('   Or check if admin endpoints are accessible.\n');
      return;
    }

    console.log(`   Found ${allVendors.length} active vendors\n`);
    console.log('='.repeat(80));
    console.log('');

    // Step 3: Get services for each vendor
    for (const vendor of allVendors) {
      console.log(`\n🏢 VENDOR: ${vendor.business_name || vendor.owner_name || 'Unnamed Vendor'}`);
      console.log(`   ID: ${vendor.id}`);
      console.log(`   Role: ${vendor.role_display_name || vendor.role_name || 'Unknown'}`);
      console.log(`   Phone: ${vendor.phone || 'N/A'}`);
      console.log(`   Type: ${vendor.vendor_type || 'N/A'}`);
      console.log(`   Configuration: ${vendor.vendor_configuration || 'N/A'}`);
      console.log('');

      try {
        // Get vendor services
        const servicesResponse = await fetchWithRetry(`${API_BASE_URL}/vendor/${vendor.id}/services`);
        
        if (!servicesResponse || !servicesResponse.success) {
          console.log('   ⚠️  Could not fetch services for this vendor');
          console.log('   ' + '-'.repeat(76));
          continue;
        }

        // Parse services from response
        let allServices = [];
        if (servicesResponse.allServices && Array.isArray(servicesResponse.allServices)) {
          allServices = servicesResponse.allServices;
        } else if (servicesResponse.services) {
          // Services grouped by style
          if (servicesResponse.services.at_home) {
            allServices.push(...(servicesResponse.services.at_home.services || []));
          }
          if (servicesResponse.services.at_center) {
            allServices.push(...(servicesResponse.services.at_center.services || []));
          }
          if (servicesResponse.services.tele) {
            allServices.push(...(servicesResponse.services.tele.services || []));
          }
        }

        if (allServices.length === 0) {
          console.log('   ⚠️  No services configured');
        } else {
          // Filter enabled services
          const enabledServices = allServices.filter(s => s.isEnabled !== false);
          const customServices = allServices.filter(s => s.isCustomService === true);
          const packages = allServices.filter(s => 
            s.isPackage === true || 
            s.metadata?.isPackage === true ||
            (s.packageDetails && Object.keys(s.packageDetails).length > 0)
          );

          console.log(`   📦 Total Services: ${allServices.length}`);
          console.log(`   ✅ Enabled Services: ${enabledServices.length}`);
          console.log(`   🎨 Custom Services: ${customServices.length}`);
          console.log(`   📋 Packages: ${packages.length}`);
          console.log('');

          // Group by service style
          const servicesByStyle = {
            at_home: [],
            at_center: [],
            tele: []
          };

          enabledServices.forEach(service => {
            const style = service.serviceStyle || service.service_style || 'unknown';
            if (servicesByStyle[style]) {
              servicesByStyle[style].push(service);
            }
          });

          // Display services by style
          ['at_home', 'at_center', 'tele'].forEach(style => {
            const styleServices = servicesByStyle[style];
            if (styleServices.length > 0) {
              const styleLabel = style === 'at_home' ? '🏠 At Home' : 
                                style === 'at_center' ? '🏥 At Center' : 
                                '📱 Tele';
              console.log(`   ${styleLabel} Services (${styleServices.length}):`);
              
              styleServices.forEach(service => {
                const custom = service.isCustomService ? '🎨 CUSTOM' : '';
                const package = (service.isPackage || service.metadata?.isPackage) ? '📋 PACKAGE' : '';
                const publishStatus = service.publishStatus || service.publish_status ? `[${service.publishStatus || service.publish_status}]` : '';
                
                console.log(`      ✅ ${service.serviceName || service.service_name || 'Unnamed'} ${custom} ${package} ${publishStatus}`);
                console.log(`         Price: ₹${service.price || service.customPrice || 0} | Duration: ${service.duration || service.durationMinutes || 0} min`);
                if (service.category || service.categoryName) {
                  console.log(`         Category: ${service.categoryName || service.category}${service.subCategoryName || service.subCategory ? ` > ${service.subCategoryName || service.subCategory}` : ''}`);
                }
              });
              console.log('');
            }
          });

          // Show custom services summary
          if (customServices.length > 0) {
            console.log(`   🎨 Custom Services Summary:`);
            customServices.forEach(service => {
              console.log(`      - ${service.serviceName || service.service_name} (${service.serviceStyle || service.service_style || 'N/A'})`);
            });
            console.log('');
          }

          // Show packages summary
          if (packages.length > 0) {
            console.log(`   📋 Packages Summary:`);
            packages.forEach(service => {
              const pkgDetails = service.packageDetails || service.metadata?.packageDetails || {};
              console.log(`      - ${service.serviceName || service.service_name}`);
              if (pkgDetails.totalSessions) {
                console.log(`        Total Sessions: ${pkgDetails.totalSessions}`);
              }
            });
            console.log('');
          }
        }
      } catch (error) {
        console.log(`   ❌ Error fetching services: ${error.message}`);
      }

      console.log('   ' + '-'.repeat(76));
    }

    // Summary
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Vendors: ${allVendors.length}`);
    
    const roleCounts = {};
    allVendors.forEach(v => {
      const role = v.role_display_name || v.role_name || 'Unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    console.log('\nBy Role:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });

    console.log('\n✅ Query completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Alternative: Run the SQL query directly:');
    console.error('   scripts/list-groomer-trainer-vendors.sql\n');
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  listGroomerTrainerVendors().catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

module.exports = { listGroomerTrainerVendors };

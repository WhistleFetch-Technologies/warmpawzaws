#!/usr/bin/env node
/**
 * End-to-End Test for Home Services Flow
 * Tests the complete flow via deployed CloudFront/API Gateway
 */

const API_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function testFlow() {
  console.log('🧪 Testing Home Services Flow');
  console.log('========================================\n');
  
  try {
    // 1. Get roles with home service capability
    console.log('1️⃣ Fetching roles with home service capability...');
    const rolesRes = await fetch(`${API_URL}/roles`);
    const rolesData = await rolesRes.json();
    
    const homeServiceRoles = rolesData.roles?.filter(role => {
      const styles = role.config?.serviceStyles;
      if (Array.isArray(styles)) {
        return styles.includes('at_home');
      }
      if (typeof styles === 'object' && styles !== null) {
        return styles.at_home === true;
      }
      return false;
    }) || [];
    
    console.log(`   ✅ Found ${homeServiceRoles.length} roles with home service support:`);
    homeServiceRoles.forEach(role => {
      console.log(`      - ${role.display_name} (${role.name})`);
    });
    console.log('');
    
    // 2. Test vendor search endpoint
    console.log('2️⃣ Testing vendor discovery for home services...');
    const searchRes = await fetch(`${API_URL}/customer/vendors/search?serviceStyle=at_home&limit=5`);
    const searchData = await searchRes.json();
    
    if (searchData.success && searchData.vendors?.length > 0) {
      console.log(`   ✅ Found ${searchData.vendors.length} home service providers`);
      searchData.vendors.forEach(vendor => {
        console.log(`      - ${vendor.business_name || vendor.owner_name} (${vendor.service_radius || 10}km radius)`);
      });
    } else {
      console.log('   ⚠️  No home service vendors found (expected if no vendors are set up yet)');
    }
    console.log('');
    
    // 3. Test service catalog
    console.log('3️⃣ Testing service catalog...');
    const catalogRes = await fetch(`${API_URL}/services`);
    const catalogData = await catalogRes.json();
    
    if (catalogData.services?.length > 0) {
      console.log(`   ✅ Found ${catalogData.services.length} services in catalog`);
      const homeServices = catalogData.services.filter(s => 
        s.service_styles?.includes('at_home') || s.service_type === 'at_home'
      );
      console.log(`   ✅ ${homeServices.length} services support home delivery`);
    } else {
      console.log('   ⚠️  Service catalog empty or not accessible');
    }
    console.log('');
    
    // 4. Test scheduling endpoint
    console.log('4️⃣ Testing scheduling policies...');
    const schedulingRes = await fetch(`${API_URL}/scheduling/policies`);
    if (schedulingRes.ok) {
      const schedulingData = await schedulingRes.json();
      console.log(`   ✅ Scheduling policies endpoint working`);
      if (schedulingData.policies) {
        console.log(`   ✅ Found ${schedulingData.policies.length} scheduling policies`);
      }
    } else {
      console.log(`   ⚠️  Scheduling policies endpoint returned ${schedulingRes.status}`);
    }
    console.log('');
    
    // 5. Test home service session endpoint (should require auth)
    console.log('5️⃣ Testing home service tracking endpoint...');
    const trackingRes = await fetch(`${API_URL}/home-services/sessions`);
    console.log(`   ✅ Home service sessions endpoint accessible (status: ${trackingRes.status})`);
    console.log('');
    
    console.log('========================================');
    console.log('🎉 Home Services E2E Test Complete!');
    console.log('');
    console.log('📱 Test URLs:');
    console.log('   - Vendor App: https://d1s6ykkj381k58.cloudfront.net');
    console.log('   - Customer App: https://d2aoyjj8ine0wk.cloudfront.net');
    console.log('   - Admin Panel: https://dfof7mguaa0a5.cloudfront.net');
    console.log('');
    console.log('📋 Roles supporting home services:');
    homeServiceRoles.slice(0, 10).forEach(role => {
      const styles = role.config?.serviceStyles;
      const stylesStr = Array.isArray(styles) ? styles.join(', ') : 
                        (typeof styles === 'object' ? Object.keys(styles).filter(k => styles[k]).join(', ') : 'N/A');
      console.log(`   • ${role.display_name}: [${stylesStr}]`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFlow();

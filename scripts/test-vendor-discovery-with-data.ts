/**
 * Test Vendor Discovery with Actual Vendor Data
 * Tests the API endpoints with known vendor IDs
 */

import * as fs from 'fs';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Known vendors from the list
const KNOWN_VENDORS = {
  trainer: {
    'rahuul menon\'s trainer solo': {
      phone: '7123456700',
      vendorId: '3ac699ca-a8b3-42ad-8874-b541aeaceb3c',
      services: ['At Home', 'Tele'],
    },
    'SAR center': {
      phone: '9899999999',
      vendorId: 'c31b60e5-4bab-4191-9afe-d7ebe770a328',
      services: ['At Home'],
    },
    'srikant sharmas centre training': {
      phone: '6123456000',
      vendorId: '55bdca98-71c9-48cb-95b6-41e8d23d2cf3',
      services: ['At Home', 'At Center'],
    },
  },
};

async function makeAPICall(method: 'GET' | 'POST', endpoint: string, payload?: any) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    };

    if (payload) {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return {
      success: response.ok,
      data,
      status: response.status,
      error: response.ok ? undefined : (data.error || data.message || response.statusText),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
      status: 500,
    };
  }
}

async function testVendorDiscovery() {
  console.log('🔍 Testing Vendor Discovery with Known Vendors\n');
  console.log('='.repeat(60));

  const results: any[] = [];

  // Test 1: Trainer Discovery - At Home
  console.log('\n📋 Test 1: Trainer Discovery (at_home)');
  const trainerHome = await makeAPICall(
    'GET',
    '/customer/discover-services?category=training&roleId=pet_trainer&serviceStyle=at_home'
  );
  
  console.log(`Status: ${trainerHome.status}`);
  console.log(`Success: ${trainerHome.success}`);
  if (trainerHome.success && trainerHome.data) {
    const vendors = trainerHome.data.vendors || trainerHome.data.services || [];
    console.log(`Vendors Found: ${vendors.length}`);
    if (vendors.length > 0) {
      console.log('Vendor IDs:');
      vendors.slice(0, 5).forEach((v: any) => {
        console.log(`  - ${v.id || v.vendorId}: ${v.name || v.businessName || 'Unknown'}`);
      });
    }
  } else {
    console.log(`Error: ${trainerHome.error}`);
  }
  results.push({ test: 'Trainer at_home', ...trainerHome });

  // Test 2: Trainer Discovery - At Center
  console.log('\n📋 Test 2: Trainer Discovery (at_center)');
  const trainerCenter = await makeAPICall(
    'GET',
    '/customer/discover-services?category=training&roleId=pet_trainer&serviceStyle=at_center'
  );
  
  console.log(`Status: ${trainerCenter.status}`);
  console.log(`Success: ${trainerCenter.success}`);
  if (trainerCenter.success && trainerCenter.data) {
    const vendors = trainerCenter.data.vendors || trainerCenter.data.services || [];
    console.log(`Vendors Found: ${vendors.length}`);
    if (vendors.length > 0) {
      console.log('Vendor IDs:');
      vendors.slice(0, 5).forEach((v: any) => {
        console.log(`  - ${v.id || v.vendorId}: ${v.name || v.businessName || 'Unknown'}`);
      });
    }
  } else {
    console.log(`Error: ${trainerCenter.error}`);
  }
  results.push({ test: 'Trainer at_center', ...trainerCenter });

  // Test 3: Groomer Discovery - At Home
  console.log('\n📋 Test 3: Groomer Discovery (at_home)');
  const groomerHome = await makeAPICall(
    'GET',
    '/customer/discover-services?category=grooming&roleId=pet_groomer&serviceStyle=at_home'
  );
  
  console.log(`Status: ${groomerHome.status}`);
  console.log(`Success: ${groomerHome.success}`);
  if (groomerHome.success && groomerHome.data) {
    const vendors = groomerHome.data.vendors || groomerHome.data.services || [];
    console.log(`Vendors Found: ${vendors.length}`);
    if (vendors.length > 0) {
      console.log('Vendor IDs:');
      vendors.slice(0, 5).forEach((v: any) => {
        console.log(`  - ${v.id || v.vendorId}: ${v.name || v.businessName || 'Unknown'}`);
      });
    }
  } else {
    console.log(`Error: ${groomerHome.error}`);
  }
  results.push({ test: 'Groomer at_home', ...groomerHome });

  // Test 4: Groomer Discovery - At Center
  console.log('\n📋 Test 4: Groomer Discovery (at_center)');
  const groomerCenter = await makeAPICall(
    'GET',
    '/customer/discover-services?category=grooming&roleId=pet_groomer&serviceStyle=at_center'
  );
  
  console.log(`Status: ${groomerCenter.status}`);
  console.log(`Success: ${groomerCenter.success}`);
  if (groomerCenter.success && groomerCenter.data) {
    const vendors = groomerCenter.data.vendors || groomerCenter.data.services || [];
    console.log(`Vendors Found: ${vendors.length}`);
    if (vendors.length > 0) {
      console.log('Vendor IDs:');
      vendors.slice(0, 5).forEach((v: any) => {
        console.log(`  - ${v.id || v.vendorId}: ${v.name || v.businessName || 'Unknown'}`);
      });
    }
  } else {
    console.log(`Error: ${groomerCenter.error}`);
  }
  results.push({ test: 'Groomer at_center', ...groomerCenter });

  // Test 5: Get Services for Known Vendor
  console.log('\n📋 Test 5: Get Services for Known Trainer Vendor');
  const knownVendorId = KNOWN_VENDORS.trainer['srikant sharmas centre training'].vendorId;
  const vendorServices = await makeAPICall('GET', `/vendor/${knownVendorId}/services`);
  
  console.log(`Status: ${vendorServices.status}`);
  console.log(`Success: ${vendorServices.success}`);
  if (vendorServices.success && vendorServices.data) {
    const services = vendorServices.data.services || vendorServices.data || [];
    console.log(`Services Found: ${services.length}`);
    services.forEach((s: any) => {
      console.log(`  - ${s.name || s.serviceName}: ${s.serviceStyle || s.service_style} (₹${s.price || 0})`);
    });
  } else {
    console.log(`Error: ${vendorServices.error}`);
  }
  results.push({ test: 'Vendor Services', ...vendorServices });

  // Test 6: Alternative Endpoint - services/by-style
  console.log('\n📋 Test 6: Alternative Endpoint (services/by-style)');
  const byStyle = await makeAPICall(
    'GET',
    '/customer/services/by-style?roleId=trainer&serviceStyle=at_home'
  );
  
  console.log(`Status: ${byStyle.status}`);
  console.log(`Success: ${byStyle.success}`);
  if (byStyle.success && byStyle.data) {
    const providers = byStyle.data.providers || byStyle.data || [];
    console.log(`Providers Found: ${Array.isArray(providers) ? providers.length : 'N/A'}`);
  } else {
    console.log(`Error: ${byStyle.error}`);
  }
  results.push({ test: 'Services by Style', ...byStyle });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  // Save results
  fs.writeFileSync(
    'vendor-discovery-test-results.json',
    JSON.stringify({ testRun: new Date().toISOString(), results }, null, 2)
  );

  console.log('\n💾 Results saved to: vendor-discovery-test-results.json');
}

testVendorDiscovery().catch(console.error);

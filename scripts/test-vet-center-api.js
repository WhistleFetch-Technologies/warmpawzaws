/**
 * Test the discover-services API endpoint for vet center
 */

const API_BASE = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const VENDOR_ID = '863d5f9f-2cec-4792-9ea8-64c98059061c';

async function testAPI() {
  console.log('='.repeat(80));
  console.log('TESTING VET CENTER DISCOVERY API');
  console.log('='.repeat(80));
  console.log(`API: ${API_BASE}/customer/discover-services`);
  console.log(`Params: category=vet&serviceStyle=at_center`);
  console.log(`Expected Vendor ID: ${VENDOR_ID}\n`);

  try {
    const url = `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_center`;
    console.log(`Fetching: ${url}\n`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.vendors && Array.isArray(data.vendors)) {
      console.log(`Found ${data.vendors.length} vendor(s)`);
      
      const foundVendor = data.vendors.find(v => v.id === VENDOR_ID || v.vendorId === VENDOR_ID);
      if (foundVendor) {
        console.log('\n✅ EXPECTED VENDOR FOUND!');
        console.log(JSON.stringify({
          id: foundVendor.id || foundVendor.vendorId,
          businessName: foundVendor.businessName,
          roleName: foundVendor.roleName,
          category: foundVendor.category,
        }, null, 2));
      } else {
        console.log('\n❌ EXPECTED VENDOR NOT FOUND!');
        if (data.vendors.length > 0) {
          console.log('\nVendors that were returned:');
          data.vendors.slice(0, 3).forEach((v, i) => {
            console.log(`  ${i + 1}. ${v.id || v.vendorId}: ${v.businessName || v.name} (role: ${v.roleName || v.role})`);
          });
        }
      }
    } else {
      console.log('❌ No vendors array in response');
    }

    // Check vendor services
    console.log('\n' + '='.repeat(80));
    console.log('CHECKING VENDOR SERVICES');
    console.log('='.repeat(80));
    try {
      const servicesUrl = `${API_BASE}/customer/vendor/${VENDOR_ID}/services`;
      console.log(`Fetching: ${servicesUrl}\n`);
      const servicesResponse = await fetch(servicesUrl);
      const servicesData = await servicesResponse.json();
      
      console.log('Vendor Services Response:');
      console.log(JSON.stringify(servicesData, null, 2));
      
      if (servicesData.services && Array.isArray(servicesData.services)) {
        console.log(`\nFound ${servicesData.services.length} service(s):`);
        servicesData.services.forEach((s, i) => {
          console.log(`\n  Service ${i + 1}:`);
          console.log(`    ID: ${s.id || s.serviceId}`);
          console.log(`    Name: ${s.name || s.serviceName}`);
          console.log(`    Style: ${s.serviceStyle || s.service_style || 'NOT SET'}`);
          console.log(`    Enabled: ${s.isEnabled !== false}`);
          console.log(`    Publish Status: ${s.publishStatus || s.publish_status || 'NOT SET'}`);
        });
        
        const atCenterServices = servicesData.services.filter(s => {
          const style = (s.serviceStyle || s.service_style || '').toLowerCase();
          return ['at_center', 'at_vendor', 'at_clinic', 'center', 'clinic'].includes(style);
        });
        
        const publishedAtCenter = atCenterServices.filter(s => {
          const publishStatus = (s.publishStatus || s.publish_status || '').toLowerCase();
          return ['published', 'auto_published'].includes(publishStatus) || !publishStatus;
        });
        
        console.log(`\n  At Center Services: ${atCenterServices.length}`);
        console.log(`  Published At Center Services: ${publishedAtCenter.length}`);
        
        if (publishedAtCenter.length === 0) {
          console.log('\n❌ ISSUE FOUND: Vendor has no published services with service_style = at_center');
          console.log('   This is why the vendor is not appearing in discover-services!');
        }
      }
    } catch (err) {
      console.log(`  Error checking services: ${err.message}`);
    }

    // Test with different variations
    console.log('\n' + '='.repeat(80));
    console.log('TESTING VARIATIONS');
    console.log('='.repeat(80));

    const variations = [
      { name: 'No serviceStyle', url: `${API_BASE}/customer/discover-services?category=vet` },
      { name: 'With roleId', url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_center&roleId=vet_clinic` },
      { name: 'With roleId only', url: `${API_BASE}/customer/discover-services?roleId=vet_clinic&serviceStyle=at_center` },
    ];

    for (const variation of variations) {
      try {
        console.log(`\nTesting: ${variation.name}`);
        const varResponse = await fetch(variation.url);
        const varData = await varResponse.json();
        const count = varData.vendors?.length || 0;
        const found = varData.vendors?.some(v => v.id === VENDOR_ID || v.vendorId === VENDOR_ID);
        console.log(`  Result: ${count} vendors, expected vendor ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testAPI();

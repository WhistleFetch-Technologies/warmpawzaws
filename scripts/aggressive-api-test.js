#!/usr/bin/env node
const https = require('https');

const API_BASE = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

function callAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('🧪 Aggressive API Testing for discover-services\n');
  
  const tests = [
    { name: 'vet + tele', url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=tele` },
    { name: 'vet + at_home', url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_home` },
    { name: 'vet (no style)', url: `${API_BASE}/customer/discover-services?category=vet` },
    { name: 'vet_solo role + tele', url: `${API_BASE}/customer/discover-services?roleId=vet_solo&serviceStyle=tele` },
    { name: 'vet_solo role + at_home', url: `${API_BASE}/customer/discover-services?roleId=vet_solo&serviceStyle=at_home` },
  ];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log('='.repeat(60));
    
    try {
      const result = await callAPI(test.url);
      console.log(`Success: ${result.success}`);
      console.log(`Total: ${result.total || 0}`);
      console.log(`Vendors: ${result.vendors?.length || 0}`);
      console.log(`Providers: ${result.providers?.length || 0}`);
      
      const allItems = [...(result.vendors || []), ...(result.providers || [])];
      if (allItems.length > 0) {
        console.log('\n✅ Found items:');
        allItems.forEach((item, idx) => {
          const name = item.businessName || item.name || item.business_name;
          const id = item.id || item.vendorId;
          console.log(`  ${idx + 1}. ${name} (${id})`);
          
          if (name && name.toLowerCase().includes('shivang')) {
            console.log(`     🎉 SHIVANG'S VENDOR FOUND!`);
          }
        });
      } else {
        console.log('\n❌ No items found');
        if (result.error) console.log(`   Error: ${result.error}`);
        if (result._debug) console.log(`   Debug: ${result._debug}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait 1 second between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary: Testing complete');
  console.log('='.repeat(60));
}

test().catch(console.error);

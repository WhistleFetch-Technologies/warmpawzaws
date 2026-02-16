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
  console.log('Testing discover-services API with different parameters...\n');
  
  const tests = [
    {
      name: 'category=vet (no serviceStyle) - SHOULD WORK',
      url: `${API_BASE}/customer/discover-services?category=vet&latitude=19.301646135742395&longitude=72.87130364732396`
    },
    {
      name: 'category=vet&serviceStyle=tele - CURRENTLY FAILS',
      url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=tele&latitude=19.301646135742395&longitude=72.87130364732396`
    },
    {
      name: 'category=vet&serviceStyle=at_home - TEST',
      url: `${API_BASE}/customer/discover-services?category=vet&serviceStyle=at_home&latitude=19.301646135742395&longitude=72.87130364732396`
    }
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
        console.log('\n✅ Found vendors/providers:');
        allItems.forEach((item, idx) => {
          const name = item.businessName || item.name || item.business_name;
          const id = item.id || item.vendorId;
          console.log(`  ${idx + 1}. ${name} (${id})`);
          
          if (name && name.toLowerCase().includes('shivang')) {
            console.log(`     🎉 SHIVANG'S VENDOR FOUND!`);
          }
        });
      } else {
        console.log('\n❌ No vendors/providers found');
        if (result.error) console.log(`  Error: ${result.error}`);
        if (result._debug) console.log(`  Debug: ${result._debug}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait 1 second between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

test().catch(console.error);

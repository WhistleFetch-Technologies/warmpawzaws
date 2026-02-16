#!/usr/bin/env node
const https = require('https');

const API_BASE = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

function callAPI(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const duration = Date.now() - startTime;
          resolve({ ...result, _duration: duration });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('Continuous testing of tele endpoint...\n');
  
  const url = `${API_BASE}/customer/discover-services?category=vet&serviceStyle=tele&latitude=19.301646135742395&longitude=72.87130364732396`;
  
  for (let i = 1; i <= 5; i++) {
    console.log(`\nTest ${i}/5:`);
    console.log(`  Calling: ${url}`);
    
    try {
      const result = await callAPI(url);
      console.log(`  Response: Success=${result.success}, Total=${result.total}, Vendors=${result.vendors?.length || 0}, Duration=${result._duration}ms`);
      
      if (result.vendors && result.vendors.length > 0) {
        console.log(`  ✅ SUCCESS! Vendor found: ${result.vendors[0].businessName}`);
        break;
      } else {
        console.log(`  ❌ No vendors found`);
        if (result.error) console.log(`    Error: ${result.error}`);
        if (result._debug) console.log(`    Debug: ${result._debug}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // Wait 2 seconds between tests
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing complete. Check CloudWatch logs for details.');
  console.log('='.repeat(60));
}

test().catch(console.error);

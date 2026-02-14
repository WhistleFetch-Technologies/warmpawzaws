#!/usr/bin/env node
const https = require('https');
const { execSync } = require('child_process');

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

function getLogs() {
  try {
    const startTime = Math.floor((Date.now() - 120000) / 1000); // 2 minutes ago
    const result = execSync(
      `aws logs filter-log-events --log-group-name /aws/lambda/warmpawz-prod-api-handler --region ap-south-1 --start-time ${startTime}000 --filter-pattern "query returned" --max-items 5 --query "events[*].message" --output text`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return result.trim();
  } catch (e) {
    return '';
  }
}

async function test() {
  console.log('Testing discover-services API with serviceStyle=tele...\n');
  console.log('Will test continuously until vendor appears...\n');
  
  const url = `${API_BASE}/customer/discover-services?category=vet&serviceStyle=tele&latitude=19.301646135742395&longitude=72.87130364732396`;
  
  let attempt = 0;
  const maxAttempts = 20;
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\n[Attempt ${attempt}/${maxAttempts}] Testing API...`);
    
    try {
      const result = await callAPI(url);
      console.log(`  Success: ${result.success}`);
      console.log(`  Total: ${result.total || 0}`);
      console.log(`  Vendors: ${result.vendors?.length || 0}`);
      console.log(`  Providers: ${result.providers?.length || 0}`);
      
      const allItems = [...(result.vendors || []), ...(result.providers || [])];
      if (allItems.length > 0) {
        console.log('\n🎉 SUCCESS! Vendor found:');
        allItems.forEach((item, idx) => {
          const name = item.businessName || item.name || item.business_name;
          const id = item.id || item.vendorId;
          console.log(`  ${idx + 1}. ${name} (${id})`);
        });
        break;
      } else {
        console.log('  ❌ No vendors found');
        
        // Check logs
        console.log('\n  Checking CloudWatch logs...');
        const logs = getLogs();
        if (logs) {
          console.log('  Recent logs:', logs.substring(0, 200));
        } else {
          console.log('  No recent logs found');
        }
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    if (attempt < maxAttempts) {
      console.log('  Waiting 3 seconds before next attempt...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  if (attempt >= maxAttempts) {
    console.log('\n❌ Max attempts reached. Vendor still not appearing.');
  }
}

test().catch(console.error);

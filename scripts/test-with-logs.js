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

async function testAndWatchLogs() {
  console.log('Testing API endpoints and watching CloudWatch logs...\n');
  
  // Test 1: Without serviceStyle (this works)
  console.log('='.repeat(60));
  console.log('TEST 1: category=vet (no serviceStyle) - This works');
  console.log('='.repeat(60));
  const url1 = `${API_BASE}/customer/discover-services?category=vet&latitude=19.301646135742395&longitude=72.87130364732396`;
  console.log(`URL: ${url1}\n`);
  
  const result1 = await callAPI(url1);
  console.log(`Success: ${result1.success}, Total: ${result1.total}, Vendors: ${result1.vendors?.length || 0}`);
  if (result1.vendors?.length > 0) {
    console.log(`✅ Vendor found: ${result1.vendors[0].businessName}`);
  }
  
  // Wait a bit for logs
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: With serviceStyle=tele (this doesn't work)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: category=vet&serviceStyle=tele - This should work but doesn\'t');
  console.log('='.repeat(60));
  const url2 = `${API_BASE}/customer/discover-services?category=vet&serviceStyle=tele&latitude=19.301646135742395&longitude=72.87130364732396`;
  console.log(`URL: ${url2}\n`);
  
  const result2 = await callAPI(url2);
  console.log(`Success: ${result2.success}, Total: ${result2.total}, Vendors: ${result2.vendors?.length || 0}`);
  if (result2.vendors?.length > 0) {
    console.log(`✅ Vendor found: ${result2.vendors[0].businessName}`);
  } else {
    console.log(`❌ No vendors found`);
  }
  
  // Wait for logs
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check CloudWatch logs
  console.log('\n' + '='.repeat(60));
  console.log('Checking CloudWatch logs...');
  console.log('='.repeat(60));
  
  try {
    const startTime = Math.floor((Date.now() - 60000) / 1000); // Last 60 seconds
    const logs = execSync(
      `aws logs filter-log-events --log-group-name /aws/lambda/warmpawz-prod-api-handler --region ap-south-1 --start-time ${startTime}000 --filter-pattern "discover-services" --max-items 30 --query 'events[*].message' --output text`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const logLines = logs.split('\n').filter(l => l.trim());
    console.log(`Found ${logLines.length} log entries:\n`);
    
    logLines.forEach((line, idx) => {
      if (line.includes('discover-services')) {
        console.log(`${idx + 1}. ${line.substring(0, 200)}...`);
      }
    });
  } catch (error) {
    console.log('Could not fetch logs:', error.message);
  }
}

testAndWatchLogs().catch(console.error);

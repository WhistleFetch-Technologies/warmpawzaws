#!/usr/bin/env node
/**
 * Quick verification script to check if service catalog replication was successful
 */

const https = require('https');

const DEV_API_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const PROD_API_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const ENDPOINT = '/admin/service-catalog';
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.argv[2];

function makeRequest(url, authToken) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

function extractServices(response) {
  if (Array.isArray(response)) return response;
  if (response.services) return response.services;
  if (response.data) return response.data;
  if (response.success && response.services) return response.services;
  if (response.success && response.data) return response.data;
  return [];
}

async function main() {
  console.log('='.repeat(80));
  console.log('SERVICE CATALOG REPLICATION VERIFICATION');
  console.log('='.repeat(80));
  console.log('');

  if (!AUTH_TOKEN) {
    console.error('❌ AUTH_TOKEN required');
    console.error('   Usage: AUTH_TOKEN="token" node verify-service-catalog-replication.js');
    process.exit(1);
  }

  try {
    console.log('📥 Fetching DEV data...');
    const devData = await makeRequest(`${DEV_API_URL}${ENDPOINT}`, AUTH_TOKEN);
    const devServices = extractServices(devData);
    console.log(`   ✅ DEV: ${devServices.length} records`);
    console.log('');

    console.log('📥 Fetching PROD data...');
    const prodData = await makeRequest(`${PROD_API_URL}${ENDPOINT}`, AUTH_TOKEN);
    const prodServices = extractServices(prodData);
    console.log(`   ✅ PROD: ${prodServices.length} records`);
    console.log('');

    // Create ID maps
    const devIds = new Set();
    const prodIds = new Set();

    for (const s of devServices) {
      const id = s.id || s.service_id;
      if (id) devIds.add(String(id));
    }

    for (const s of prodServices) {
      const id = s.id || s.service_id;
      if (id) prodIds.add(String(id));
    }

    // Find missing
    const missingInProd = [];
    for (const id of devIds) {
      if (!prodIds.has(id)) {
        const service = devServices.find(s => String(s.id || s.service_id) === id);
        missingInProd.push({ id, name: service?.service_name || service?.display_name || id });
      }
    }

    console.log('='.repeat(80));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`📊 DEV records: ${devServices.length}`);
    console.log(`📊 PROD records: ${prodServices.length}`);
    console.log(`📈 Difference: ${prodServices.length - devServices.length}`);
    console.log('');

    if (missingInProd.length === 0) {
      console.log('✅ SUCCESS: All DEV records are present in PROD!');
      console.log('✅ Replication verified successfully!');
    } else {
      console.log(`❌ WARNING: ${missingInProd.length} records still missing in PROD:`);
      for (const item of missingInProd.slice(0, 10)) {
        console.log(`   - ${item.id}: ${item.name}`);
      }
      if (missingInProd.length > 10) {
        console.log(`   ... and ${missingInProd.length - 10} more`);
      }
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

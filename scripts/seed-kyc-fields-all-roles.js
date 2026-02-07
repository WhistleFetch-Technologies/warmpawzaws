#!/usr/bin/env node
/**
 * Seed KYC Fields for All Roles
 * Calls the /admin/onboarding-fields/migrate-kyc endpoint to populate onboarding_forms
 */

const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        // Note: This endpoint should be accessible without auth in dev/UAT mode
        // If it requires auth, you'll need to add the admin token
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function seedKYCFields() {
  console.log('🚀 Seeding KYC Fields for All Roles');
  console.log('=====================================');
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  try {
    // Call the migrate-kyc endpoint
    console.log('📤 Calling /admin/onboarding-fields/migrate-kyc...');
    const result = await makeRequest('POST', '/admin/onboarding-fields/migrate-kyc');

    console.log(`   Status: ${result.status}`);
    console.log('');

    if (result.status === 200 && result.data.success) {
      console.log('✅ KYC Fields Migration Successful!');
      console.log('');
      console.log('📊 Summary:');
      if (result.data.summary) {
        console.log(`   Total Roles: ${result.data.summary.totalRoles || 'N/A'}`);
        console.log(`   Created: ${result.data.summary.created || 0}`);
        console.log(`   Updated: ${result.data.summary.updated || 0}`);
        console.log(`   Skipped: ${result.data.summary.skipped || 0}`);
        console.log(`   Errors: ${result.data.summary.errors || 0}`);
      }
      console.log('');
      console.log(`   Message: ${result.data.message || 'N/A'}`);
      
      // Show results for each role
      if (result.data.results && Array.isArray(result.data.results)) {
        console.log('');
        console.log('📋 Per-Role Results:');
        for (const r of result.data.results) {
          const status = r.status === 'created' ? '✅' : 
                        r.status === 'updated' ? '🔄' :
                        r.status === 'skipped' ? '⏭️' : '❌';
          console.log(`   ${status} ${r.roleName || r.roleId}: ${r.status} ${r.kycFieldsAdded ? `(${r.kycFieldsAdded} fields)` : ''}`);
        }
      }
    } else {
      console.log('❌ Migration Failed');
      console.log('   Response:', JSON.stringify(result.data, null, 2));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedKYCFields();

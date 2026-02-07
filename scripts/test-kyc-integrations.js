#!/usr/bin/env node
/**
 * Test KYC Integration Endpoints
 * Tests Aadhaar OTP, PAN verify, and GST verify endpoints
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
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testKYCIntegrations() {
  console.log('🔍 KYC Integration Tests');
  console.log('========================');
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  const results = [];

  // Test 1: Aadhaar OTP Generation (sandbox mode)
  console.log('📋 1. AADHAAR OTP GENERATION');
  console.log('----------------------------');
  try {
    const aadhaarResponse = await makeRequest('POST', '/kyc/aadhaar/generate-otp', {
      aadhaarNumber: '123456789012', // Test Aadhaar number
      vendorId: 'test-vendor-123',
    });
    
    console.log(`   Status: ${aadhaarResponse.status}`);
    console.log(`   Response: ${JSON.stringify(aadhaarResponse.data, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    // In sandbox mode, should return success with mock transaction ID
    if (aadhaarResponse.status === 200 && aadhaarResponse.data.success) {
      console.log('   ✅ Aadhaar OTP generation endpoint works (sandbox mode)');
      results.push({ test: 'Aadhaar OTP Generation', passed: true });
    } else if (aadhaarResponse.status === 200 && aadhaarResponse.data.mock) {
      console.log('   ✅ Aadhaar OTP generation returns mock response (provider not configured)');
      results.push({ test: 'Aadhaar OTP Generation', passed: true, note: 'Mock mode' });
    } else {
      console.log('   ⚠️ Unexpected response');
      results.push({ test: 'Aadhaar OTP Generation', passed: false });
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'Aadhaar OTP Generation', passed: false, error: err.message });
  }
  console.log('');

  // Test 2: Aadhaar OTP Verification (sandbox mode)
  console.log('📋 2. AADHAAR OTP VERIFICATION');
  console.log('------------------------------');
  try {
    const verifyResponse = await makeRequest('POST', '/kyc/aadhaar/verify-otp', {
      requestId: 'mock_test_123',
      otp: '123456',
      vendorId: 'test-vendor-123',
    });
    
    console.log(`   Status: ${verifyResponse.status}`);
    console.log(`   Response: ${JSON.stringify(verifyResponse.data, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    if (verifyResponse.status === 200 && (verifyResponse.data.success || verifyResponse.data.mock)) {
      console.log('   ✅ Aadhaar OTP verification endpoint works');
      results.push({ test: 'Aadhaar OTP Verification', passed: true });
    } else {
      console.log('   ⚠️ Unexpected response (may need valid transaction ID)');
      results.push({ test: 'Aadhaar OTP Verification', passed: false });
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'Aadhaar OTP Verification', passed: false, error: err.message });
  }
  console.log('');

  // Test 3: PAN Verification (sandbox mode)
  console.log('📋 3. PAN VERIFICATION');
  console.log('----------------------');
  try {
    const panResponse = await makeRequest('POST', '/kyc/pan/verify', {
      panNumber: 'ABCDE1234F', // Test PAN number
      vendorId: 'test-vendor-123',
      nameToMatch: 'Test User',
    });
    
    console.log(`   Status: ${panResponse.status}`);
    console.log(`   Response: ${JSON.stringify(panResponse.data, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    if (panResponse.status === 200 && (panResponse.data.success || panResponse.data.mock)) {
      console.log('   ✅ PAN verification endpoint works');
      results.push({ test: 'PAN Verification', passed: true });
    } else {
      console.log('   ⚠️ Unexpected response');
      results.push({ test: 'PAN Verification', passed: false });
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'PAN Verification', passed: false, error: err.message });
  }
  console.log('');

  // Test 4: GST Verification (sandbox mode)
  console.log('📋 4. GST VERIFICATION');
  console.log('----------------------');
  try {
    const gstResponse = await makeRequest('POST', '/kyc/gst/verify', {
      gstin: '29ABCDE1234F1Z5', // Test GSTIN
      vendorId: 'test-vendor-123',
    });
    
    console.log(`   Status: ${gstResponse.status}`);
    console.log(`   Response: ${JSON.stringify(gstResponse.data, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    if (gstResponse.status === 200 && (gstResponse.data.success || gstResponse.data.mock)) {
      console.log('   ✅ GST verification endpoint works');
      results.push({ test: 'GST Verification', passed: true });
    } else {
      console.log('   ⚠️ Unexpected response');
      results.push({ test: 'GST Verification', passed: false });
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'GST Verification', passed: false, error: err.message });
  }
  console.log('');

  // Test 5: KYC Status
  console.log('📋 5. KYC STATUS CHECK');
  console.log('----------------------');
  try {
    const statusResponse = await makeRequest('GET', '/kyc/status/test-vendor-123');
    
    console.log(`   Status: ${statusResponse.status}`);
    console.log(`   Response: ${JSON.stringify(statusResponse.data, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    if (statusResponse.status === 200) {
      console.log('   ✅ KYC status endpoint works');
      results.push({ test: 'KYC Status', passed: true });
    } else {
      console.log('   ⚠️ Unexpected response');
      results.push({ test: 'KYC Status', passed: false });
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'KYC Status', passed: false, error: err.message });
  }
  console.log('');

  // Summary
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('===========================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    const note = r.note ? ` (${r.note})` : '';
    const error = r.error ? ` - ${r.error}` : '';
    console.log(`   ${status} ${r.test}${note}${error}`);
  }
  
  console.log('');
  console.log(`Total: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('');
    console.log('✅ ALL KYC INTEGRATION TESTS PASSED!');
  } else {
    console.log('');
    console.log(`⚠️  ${total - passed} test(s) need attention`);
  }
}

testKYCIntegrations().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

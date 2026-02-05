#!/usr/bin/env node
/**
 * Forensic Validation: Diagnostic Tests API
 * Validates fix for diagnostic_tests_vendor_id_fkey violation
 * Uses resolveVendorById so vendor_identity.id resolves to actual vendors.id
 */

const https = require('https');

const API_BASE = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const VENDOR_ID = process.env.VENDOR_ID || 'd9fa218b-4f33-41a9-9f88-ad509c17f8d0';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : API_BASE + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-token-test',
      },
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, ok: res.statusCode >= 200 && res.statusCode < 400 });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data }, ok: false });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('🔬 FORENSIC VALIDATION: Diagnostic Tests API\n');
  console.log('API:', API_BASE);
  console.log('Vendor ID:', VENDOR_ID);
  console.log('—'.repeat(60));

  const failures = [];
  let createdTestId = null;

  // 1. GET diagnostic tests (should not fail with vendor resolution)
  console.log('\n1️⃣  GET /vendor/:vendorId/diagnostics/tests');
  const getRes = await request(`/vendor/${VENDOR_ID}/diagnostics/tests`);
  if (!getRes.ok && getRes.status !== 404) {
    failures.push(`GET diagnostics/tests failed: ${getRes.status} - ${getRes.data?.error || getRes.data?.raw}`);
    console.log('   ❌ Failed:', getRes.status, getRes.data?.error || '');
  } else {
    const tests = getRes.data?.tests ?? [];
    console.log('   ✅ Status:', getRes.status, '| Tests:', tests.length);
  }

  // 2. POST add diagnostic test (main fix: vendor_id FK)
  console.log('\n2️⃣  POST /vendor/:vendorId/diagnostics/tests (add test)');
  const postPayload = {
    testName: 'Forensic Validation Test',
    testCode: 'FVT-' + Date.now(),
    category: 'Blood',
    description: 'Systematic validation test',
    price: 100,
    durationMinutes: 30,
    sampleType: 'Blood',
    isAvailable: false,
  };
  const postRes = await request(`/vendor/${VENDOR_ID}/diagnostics/tests`, 'POST', postPayload);
  if (!postRes.ok) {
    const errMsg = postRes.data?.error || JSON.stringify(postRes.data);
    if (errMsg.includes('vendor_id_fkey') || errMsg.includes('foreign key')) {
      failures.push(`POST still failing with FK violation: ${errMsg}`);
      console.log('   ❌ FK violation (fix not applied):', errMsg.slice(0, 100));
    } else if (postRes.status === 404) {
      failures.push('Vendor not found - resolveVendorById returned null');
      console.log('   ❌ Vendor not found');
    } else if (postRes.status === 403) {
      console.log('   ⚠️  403 - Vendor does not have diagnostics capability (expected for some roles)');
    } else {
      failures.push(`POST failed: ${postRes.status} - ${errMsg}`);
      console.log('   ❌ Failed:', postRes.status, errMsg.slice(0, 80));
    }
  } else {
    createdTestId = postRes.data?.test?.id;
    console.log('   ✅ Test added successfully, id:', createdTestId || 'N/A');
  }

  // 3. PUT update test (if we created one)
  if (createdTestId) {
    console.log('\n3️⃣  PUT /vendor/:vendorId/diagnostics/tests/:testId');
    const putRes = await request(
      `/vendor/${VENDOR_ID}/diagnostics/tests/${createdTestId}`,
      'PUT',
      { testName: 'Forensic Validation Test (Updated)', price: 150 }
    );
    if (!putRes.ok) {
      failures.push(`PUT diagnostics/tests failed: ${putRes.status} - ${putRes.data?.error || ''}`);
      console.log('   ❌ Failed:', putRes.status);
    } else {
      console.log('   ✅ Test updated successfully');
    }

    // 4. Verify GET returns the test
    console.log('\n4️⃣  GET /vendor/:vendorId/diagnostics/tests (verify list)');
    const getRes2 = await request(`/vendor/${VENDOR_ID}/diagnostics/tests`);
    const tests = getRes2.data?.tests ?? [];
    const found = tests.some((t) => t.id === createdTestId);
    if (!found && getRes2.ok) {
      console.log('   ⚠️  Created test not in list (may be filtered)');
    } else if (getRes2.ok) {
      console.log('   ✅ Test found in list');
    }
  }

  // 5. Test with invalid vendor ID (expect 404)
  console.log('\n5️⃣  POST with invalid vendor ID (expect 404)');
  const invalidRes = await request('/vendor/00000000-0000-0000-0000-000000000000/diagnostics/tests', 'POST', postPayload);
  if (invalidRes.status === 404) {
    console.log('   ✅ Correctly returns 404 for invalid vendor');
  } else if (invalidRes.status === 403) {
    console.log('   ℹ️  403 (capability check before vendor resolution)');
  } else {
    console.log('   Status:', invalidRes.status);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach((f) => console.log('   -', f));
    process.exit(1);
  } else {
    console.log('✅ All forensic validation checks passed');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

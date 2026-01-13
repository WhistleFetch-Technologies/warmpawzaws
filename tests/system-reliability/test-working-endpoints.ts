#!/usr/bin/env node
/**
 * ============================================================================
 * WORKING ENDPOINTS TEST SUITE
 * ============================================================================
 * 
 * Tests endpoints that don't require booking creation
 * These can run independently while booking body parsing is fixed
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE_URL = process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  passed: boolean;
  statusCode?: number;
  error?: string;
  response?: any;
}

function httpRequest(urlString: string, method: string = 'GET', body?: any, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTest(name: string, endpoint: string, method: string = 'GET', body?: any, expectedStatus?: number, acceptNotFound?: boolean): Promise<TestResult> {
  try {
    const result = await httpRequest(`${API_BASE_URL}${endpoint}`, method, body);
    // Pass if: no error (or error is expected like "Booking not found" for refund-policy)
    // or status code matches expected, or is < 400, or is 404 but we accept it
    const hasExpectedError = result.body?.error && (
      result.body.error === 'Booking not found' || 
      result.body.error === 'Customer not found' ||
      result.body.error === 'Vendor not found'
    );
    const passed = (!result.body?.error || hasExpectedError) && 
                   (expectedStatus ? result.statusCode === expectedStatus : 
                    acceptNotFound ? result.statusCode < 500 : result.statusCode < 400);
    return { 
      name, 
      endpoint, 
      method, 
      passed, 
      statusCode: result.statusCode, 
      response: result.body 
    };
  } catch (error: any) {
    return { name, endpoint, method, passed: false, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  WORKING ENDPOINTS TEST SUITE                             ║');
  console.log('║  Testing endpoints that don\'t require bookings            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`🌐 API Endpoint: ${API_BASE_URL}\n`);

  const tests: TestResult[] = [];

  // Health & System Tests
  console.log('📋 Testing Health & System Endpoints...\n');
  tests.push(await runTest('Health Check', '/health', 'GET', undefined, 200));
  tests.push(await runTest('System Health', '/system/health', 'GET'));

  // Customer Profile Tests (without booking dependency)
  console.log('📋 Testing Customer Profile Endpoints...\n');
  tests.push(await runTest('Get Customer Profile (non-existent)', '/customer/profile/test-customer-123', 'GET', undefined, undefined, true));
  tests.push(await runTest('Get Customer Profile Unified (non-existent)', '/customer/profile/unified/test-customer-123', 'GET', undefined, undefined, true));

  // Vendor Profile Tests
  console.log('📋 Testing Vendor Profile Endpoints...\n');
  tests.push(await runTest('Get Vendor Profile (non-existent)', '/vendor/test-vendor-123/profile', 'GET'));

  // Service Discovery Tests
  console.log('📋 Testing Service Discovery Endpoints...\n');
  tests.push(await runTest('Get Service Catalog (admin)', '/admin/catalog/services', 'GET'));
  tests.push(await runTest('Get Service Catalog by Role', '/service-catalog/role/veterinary', 'GET'));
  tests.push(await runTest('Discover Services', '/customer/discover-services', 'GET'));
  tests.push(await runTest('Get Customer Services', '/customer/services', 'GET'));
  tests.push(await runTest('Search Vendors', '/customer/vendors/search?query=veterinary', 'GET'));

  // Refund Policy Tests (doesn't require actual booking - will return "Booking not found" but endpoint works)
  console.log('📋 Testing Refund Policy Endpoints...\n');
  tests.push(await runTest('Calculate Refund (non-existent booking)', '/refund-policy/calculate', 'POST', {
    bookingId: 'test-booking-123',
    cancellationTime: '2026-01-15T10:00:00Z',
  }, undefined, true)); // Accept "Booking not found" as valid response (endpoint works)

  // Tax Calculation Tests (if endpoint exists)
  console.log('📋 Testing Tax Calculation Endpoints...\n');
  tests.push(await runTest('Calculate Tax', '/tax/calculate', 'POST', {
    items: [{ amount: 1000, hsnCode: '998314' }],
    customerLocation: { state: 'Maharashtra' },
    vendorLocation: { state: 'Maharashtra' },
  }));

  // Payment Gateway Tests
  console.log('📋 Testing Payment Gateway Endpoints...\n');
  tests.push(await runTest('Get Payment Gateway Status', '/payment-gateway/status', 'GET'));

  // Print Results
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS:\n');
  
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  tests.forEach((test) => {
    const icon = test.passed ? '✅' : '❌';
    const status = test.statusCode ? `[${test.statusCode}]` : '';
    console.log(`${icon} ${test.method} ${test.endpoint} ${status}`);
    
    if (!test.passed) {
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else if (test.response?.error) {
        console.log(`   Error: ${typeof test.response.error === 'string' ? test.response.error : JSON.stringify(test.response.error).substring(0, 100)}`);
      } else if (test.statusCode === 404) {
        console.log(`   ⚠️  Endpoint not found (expected for some tests)`);
      } else if (test.statusCode === 500) {
        console.log(`   ⚠️  Internal Server Error`);
      }
    } else if (test.response) {
      console.log(`   ✅ Working correctly`);
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Tests: ${tests.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Pass Rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

  // Identify working endpoints
  const workingEndpoints = tests.filter((t) => t.passed && t.statusCode && t.statusCode < 400);
  if (workingEndpoints.length > 0) {
    console.log('✅ WORKING ENDPOINTS:');
    workingEndpoints.forEach((test) => {
      console.log(`   ${test.method} ${test.endpoint}`);
    });
    console.log('');
  }

  // Identify endpoints that need investigation
  const errorEndpoints = tests.filter((t) => !t.passed && t.statusCode === 500);
  if (errorEndpoints.length > 0) {
    console.log('⚠️  ENDPOINTS WITH ERRORS (need investigation):');
    errorEndpoints.forEach((test) => {
      console.log(`   ${test.method} ${test.endpoint}`);
    });
    console.log('');
  }

  // Identify missing endpoints
  const missingEndpoints = tests.filter((t) => !t.passed && t.statusCode === 404);
  if (missingEndpoints.length > 0) {
    console.log('❓ MISSING ENDPOINTS (may need to be created):');
    missingEndpoints.forEach((test) => {
      console.log(`   ${test.method} ${test.endpoint}`);
    });
    console.log('');
  }
}

main().catch(console.error);

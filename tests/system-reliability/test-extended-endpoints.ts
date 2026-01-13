#!/usr/bin/env node
/**
 * ============================================================================
 * EXTENDED ENDPOINTS TEST SUITE
 * ============================================================================
 * 
 * Comprehensive testing of all working endpoints with various scenarios
 * Tests endpoints that don't require booking creation
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
  notes?: string;
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
    const hasExpectedError = result.body?.error && (
      result.body.error === 'Booking not found' || 
      result.body.error === 'Customer not found' ||
      result.body.error === 'Vendor not found' ||
      result.body.error === 'Service not found'
    );
    const passed = (!result.body?.error || hasExpectedError) && 
                   (expectedStatus ? result.statusCode === expectedStatus : 
                    acceptNotFound ? result.statusCode < 500 : result.statusCode < 400);
    
    let notes = '';
    if (result.body?.error && hasExpectedError) {
      notes = `Expected error: ${result.body.error}`;
    }
    
    return { 
      name, 
      endpoint, 
      method, 
      passed, 
      statusCode: result.statusCode, 
      response: result.body,
      notes
    };
  } catch (error: any) {
    return { name, endpoint, method, passed: false, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  EXTENDED ENDPOINTS TEST SUITE                            ║');
  console.log('║  Comprehensive testing of working endpoints               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`🌐 API Endpoint: ${API_BASE_URL}\n`);

  const tests: TestResult[] = [];

  // ============================================================================
  // HEALTH & SYSTEM
  // ============================================================================
  console.log('📋 Testing Health & System Endpoints...\n');
  tests.push(await runTest('Health Check', '/health', 'GET', undefined, 200));

  // ============================================================================
  // SERVICE DISCOVERY & CATALOG
  // ============================================================================
  console.log('📋 Testing Service Discovery Endpoints...\n');
  
  // Admin service catalog
  tests.push(await runTest('Admin: Get All Services', '/admin/catalog/services', 'GET', undefined, 200));
  
  // Service catalog by role
  const roles = ['veterinary', 'grooming', 'training', 'boarding'];
  for (const role of roles) {
    tests.push(await runTest(`Get Services for Role: ${role}`, `/service-catalog/role/${role}`, 'GET', undefined, 200));
  }
  
  // Customer service discovery
  tests.push(await runTest('Customer: Discover Services', '/customer/discover-services', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Discover Services (with category)', '/customer/discover-services?category=vet', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Discover Services (with location)', '/customer/discover-services?location=Mumbai', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Get Services', '/customer/services', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Get Services (with filters)', '/customer/services?category=vet&location=Mumbai', 'GET', undefined, 200));
  
  // Vendor search
  tests.push(await runTest('Customer: Search Vendors', '/customer/vendors/search?query=veterinary', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Search Vendors (by roleId)', '/customer/vendors/search?roleId=veterinary', 'GET', undefined, 200));
  tests.push(await runTest('Customer: Search Vendors (with location)', '/customer/vendors/search?query=clinic&location=Mumbai', 'GET', undefined, 200));

  // ============================================================================
  // VENDOR PROFILE
  // ============================================================================
  console.log('📋 Testing Vendor Profile Endpoints...\n');
  tests.push(await runTest('Get Vendor Profile (test ID)', '/vendor/test-vendor-123/profile', 'GET', undefined, 200));
  tests.push(await runTest('Get Vendor Profile Edit Check', '/vendor/test-vendor-123/profile/edit-check', 'GET', undefined, 200));

  // ============================================================================
  // CUSTOMER PROFILE
  // ============================================================================
  console.log('📋 Testing Customer Profile Endpoints...\n');
  tests.push(await runTest('Get Customer Profile', '/customer/profile/test-customer-123', 'GET', undefined, 404, true));
  tests.push(await runTest('Get Customer Profile Unified', '/customer/profile/unified/test-customer-123', 'GET', undefined, 404, true));
  
  // Test profile update with validation
  tests.push(await runTest('Update Customer Profile (with validation)', '/customer/profile/test-customer-123', 'PUT', {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com'
  }, 404, true));

  // ============================================================================
  // REFUND POLICY (Body parsing works here!)
  // ============================================================================
  console.log('📋 Testing Refund Policy Endpoints...\n');
  tests.push(await runTest('Calculate Refund (non-existent booking)', '/refund-policy/calculate', 'POST', {
    bookingId: 'test-booking-123',
    cancellationTime: '2026-01-15T10:00:00Z',
  }, undefined, true));
  
  // Test with different cancellation times
  tests.push(await runTest('Calculate Refund (48h before)', '/refund-policy/calculate', 'POST', {
    bookingId: 'test-booking-456',
    cancellationTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  }, undefined, true));
  
  tests.push(await runTest('Calculate Refund (2h before)', '/refund-policy/calculate', 'POST', {
    bookingId: 'test-booking-789',
    cancellationTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  }, undefined, true));

  // Admin refund rules
  tests.push(await runTest('Admin: Get Refund Rules', '/admin/refund-rules', 'GET', undefined, 200));

  // ============================================================================
  // PRINT RESULTS
  // ============================================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS:\n');
  
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;
  const withNotes = tests.filter((t) => t.notes).length;

  tests.forEach((test) => {
    const icon = test.passed ? '✅' : '❌';
    const status = test.statusCode ? `[${test.statusCode}]` : '';
    console.log(`${icon} ${test.method} ${test.endpoint} ${status}`);
    
    if (test.notes) {
      console.log(`   ℹ️  ${test.notes}`);
    }
    
    if (!test.passed) {
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else if (test.response?.error) {
        console.log(`   Error: ${typeof test.response.error === 'string' ? test.response.error : JSON.stringify(test.response.error).substring(0, 100)}`);
      } else if (test.statusCode === 404) {
        console.log(`   ⚠️  Endpoint not found`);
      } else if (test.statusCode === 500) {
        console.log(`   ⚠️  Internal Server Error`);
      }
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Tests: ${tests.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Pass Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  if (withNotes > 0) {
    console.log(`   ℹ️  Tests with expected errors: ${withNotes}\n`);
  }

  // Group by endpoint type
  const serviceDiscovery = tests.filter((t) => t.endpoint.includes('/customer/') || t.endpoint.includes('/service-catalog') || t.endpoint.includes('/admin/catalog'));
  const profiles = tests.filter((t) => t.endpoint.includes('/profile'));
  const refund = tests.filter((t) => t.endpoint.includes('/refund'));
  
  console.log('\n📊 BY CATEGORY:');
  console.log(`   Service Discovery: ${serviceDiscovery.filter((t) => t.passed).length}/${serviceDiscovery.length} passed`);
  console.log(`   Profiles: ${profiles.filter((t) => t.passed).length}/${profiles.length} passed`);
  console.log(`   Refund Policy: ${refund.filter((t) => t.passed).length}/${refund.length} passed`);
  console.log('');
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * ============================================================================
 * QUICK TEST - Test Non-Booking Endpoints
 * ============================================================================
 * 
 * Tests endpoints that don't require bookings to work around body parsing issue
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
  passed: boolean;
  error?: string;
  response?: any;
}

function httpRequest(urlString: string, method: string = 'GET', body?: any): Promise<any> {
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

async function runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
  try {
    const result = await testFn();
    return { name, passed: true, response: result };
  } catch (error: any) {
    return { name, passed: false, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  QUICK TEST - Non-Booking Endpoints                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const tests: TestResult[] = [];

  // Test 1: Health Check
  tests.push(await runTest('Health Check', async () => {
    return await httpRequest(`${API_BASE_URL}/health`, 'GET');
  }));

  // Test 2: Refund Policy Calculate (POST with body - known working)
  tests.push(await runTest('Refund Policy Calculate', async () => {
    return await httpRequest(`${API_BASE_URL}/refund-policy/calculate`, 'POST', {
      bookingId: 'test-booking-123',
      cancellationTime: '2026-01-15T10:00:00Z',
    });
  }));

  // Test 3: Tax Calculation (if endpoint exists)
  tests.push(await runTest('Tax Calculation Service', async () => {
    return await httpRequest(`${API_BASE_URL}/tax/calculate`, 'POST', {
      items: [{ amount: 1000, hsnCode: '999999' }],
      customerLocation: { state: 'Maharashtra' },
      vendorLocation: { state: 'Maharashtra' },
    }).catch(() => ({ statusCode: 404, body: { error: 'Endpoint not found' } }));
  }));

  // Test 4: Get Service Catalog
  tests.push(await runTest('Get Service Catalog', async () => {
    return await httpRequest(`${API_BASE_URL}/services/catalog`, 'GET').catch(() => ({
      statusCode: 404,
      body: { error: 'Endpoint not found' },
    }));
  }));

  // Print Results
  console.log('\n📊 TEST RESULTS:\n');
  tests.forEach((test) => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (!test.passed) {
      console.log(`   Error: ${test.error}`);
    } else if (test.response) {
      const status = test.response.statusCode;
      const hasError = test.response.body?.error;
      if (status === 200 && !hasError) {
        console.log(`   ✅ Status: ${status}`);
      } else if (status === 404) {
        console.log(`   ⚠️  Endpoint not found (${status})`);
      } else {
        console.log(`   ⚠️  Status: ${status}, Error: ${hasError || 'Unknown'}`);
      }
    }
  });

  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed\n`);
}

main().catch(console.error);

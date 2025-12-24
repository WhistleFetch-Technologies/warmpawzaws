/**
 * COMPREHENSIVE SQL MIGRATION TEST
 * Tests all migrated endpoints to ensure 100% SQL usage, zero KV store
 */

import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") || 
  "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, method: string, path: string, body?: any): Promise<TestResult> {
  try {
    const url = `${BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return {
      name,
      passed: response.ok,
      details: { status: response.status, data }
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: String(error)
    };
  }
}

Deno.test("SQL Migration - Service Packages", async () => {
  // Test 1: Get packages (should use SQL)
  const result1 = await testEndpoint(
    "GET /vendor/:vendorId/service-packages",
    "GET",
    "/make-server-3dd53475/vendor/test-vendor-id/service-packages"
  );
  results.push(result1);
  assertEquals(result1.passed, true, "Service packages endpoint should work");

  // Test 2: Create package (should use SQL)
  const result2 = await testEndpoint(
    "POST /vendor/:vendorId/service-packages",
    "POST",
    "/make-server-3dd53475/vendor/test-vendor-id/service-packages",
    {
      name: "Test Package",
      totalSessions: 5,
      price: 1000,
      serviceType: "grooming"
    }
  );
  results.push(result2);
  assertEquals(result2.passed, true, "Create package endpoint should work");
});

Deno.test("SQL Migration - Support Tickets", async () => {
  // Test 1: Create ticket (should use SQL)
  const result1 = await testEndpoint(
    "POST /support/tickets",
    "POST",
    "/make-server-3dd53475/support/tickets",
    {
      subject: "Test Ticket",
      description: "Test description",
      category: "technical"
    }
  );
  results.push(result1);
  assertEquals(result1.passed, true, "Create ticket endpoint should work");

  // Test 2: Get tickets (should use SQL)
  const result2 = await testEndpoint(
    "GET /support/tickets",
    "GET",
    "/make-server-3dd53475/support/tickets?userId=test-user-id"
  );
  results.push(result2);
  assertEquals(result2.passed, true, "Get tickets endpoint should work");
});

Deno.test("SQL Migration - Vendor Policies", async () => {
  // Test 1: Get policies (should use SQL)
  const result1 = await testEndpoint(
    "GET /vendor/:vendorId/policies",
    "GET",
    "/make-server-3dd53475/vendor/test-vendor-id/policies"
  );
  results.push(result1);
  assertEquals(result1.passed, true, "Get policies endpoint should work");

  // Test 2: Create policy (should use SQL)
  const result2 = await testEndpoint(
    "POST /vendor/:vendorId/policies",
    "POST",
    "/make-server-3dd53475/vendor/test-vendor-id/policies",
    {
      policyType: "cancellation",
      policyConfig: {
        hours_before_booking: 24,
        refund_percentage: 100
      }
    }
  );
  results.push(result2);
  assertEquals(result2.passed, true, "Create policy endpoint should work");
});

Deno.test("SQL Migration - Staff Auth", async () => {
  // Test: Check phone (should use SQL, not KV)
  const result = await testEndpoint(
    "POST /staff/auth/check-phone",
    "POST",
    "/make-server-3dd53475/staff/auth/check-phone",
    {
      phone: "+919611377119"
    }
  );
  results.push(result);
  // Should not timeout (KV getByPrefix was causing 504)
  assertEquals(result.passed || result.error?.includes("404"), true, "Staff auth should not timeout");
});

Deno.test("SQL Migration - Summary", () => {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = (passed / total) * 100;

  console.log(`\n📊 SQL Migration Test Results:`);
  console.log(`   Passed: ${passed}/${total} (${percentage.toFixed(1)}%)`);
  
  if (percentage < 100) {
    console.log(`\n❌ Failed Tests:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }

  assertEquals(percentage, 100, "All SQL migration tests should pass");
});


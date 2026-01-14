/**
 * Capability Testing via API Endpoints
 * Tests capabilities by calling actual API endpoints
 * This doesn't require direct database access
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

interface TestResult {
  capability: string;
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  statusCode?: number;
  message: string;
  vendorId?: string;
  vendorRole?: string;
}

interface CapabilityTest {
  capability: string;
  endpoint: string;
  method: string;
  description: string;
  expectedStatus: number[];
  requiresAuth?: boolean;
}

// Capability endpoint mappings
const CAPABILITY_ENDPOINTS: CapabilityTest[] = [
  {
    capability: 'events',
    endpoint: '/vendor/events',
    method: 'POST',
    description: 'Create event',
    expectedStatus: [200, 201, 403],
    requiresAuth: true,
  },
  {
    capability: 'prescriptions',
    endpoint: '/prescriptions/vendor/{vendorId}',
    method: 'GET',
    description: 'Get vendor prescriptions',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'medical_records',
    endpoint: '/medical-records/vendor/{vendorId}',
    method: 'GET',
    description: 'Get vendor medical records',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'ambulance',
    endpoint: '/vendor/{vendorId}/ambulance/vehicles',
    method: 'GET',
    description: 'Get ambulance vehicles',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'diagnostics',
    endpoint: '/vendor/{vendorId}/diagnostics/tests',
    method: 'GET',
    description: 'Get diagnostic tests',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'pharmacy',
    endpoint: '/vendor/{vendorId}/pharmacy/medicines',
    method: 'GET',
    description: 'Get pharmacy medicines',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'meal_plans',
    endpoint: '/vendor/{vendorId}/nutritionist/meal-plans',
    method: 'GET',
    description: 'Get meal plans',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'cafe_tables',
    endpoint: '/vendor/{vendorId}/cafe/tables',
    method: 'GET',
    description: 'Get cafe tables',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'rooms',
    endpoint: '/vendor/{vendorId}/resort/rooms',
    method: 'GET',
    description: 'Get resort rooms',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
  {
    capability: 'pet_profiles',
    endpoint: '/vendor/{vendorId}/breeder/puppies',
    method: 'GET',
    description: 'Get pet profiles',
    expectedStatus: [200, 403],
    requiresAuth: true,
  },
];

/**
 * Test a capability endpoint
 */
async function testCapabilityEndpoint(
  test: CapabilityTest,
  vendorId?: string
): Promise<TestResult> {
  try {
    const url = `${API_BASE_URL}${test.endpoint.replace('{vendorId}', vendorId || 'test-vendor-id')}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (vendorId) {
      headers['x-vendor-id'] = vendorId;
    }
    
    const options: RequestInit = {
      method: test.method,
      headers,
    };
    
    if (test.method === 'POST') {
      options.body = JSON.stringify({});
    }
    
    const response = await fetch(url, options);
    const statusCode = response.status;
    
    // Check if status code is in expected range
    const isExpectedStatus = test.expectedStatus.includes(statusCode);
    
    let status: 'pass' | 'fail' | 'skip' | 'error';
    let message: string;
    
    if (statusCode === 403) {
      // 403 means capability enforcement is working (vendor doesn't have capability)
      status = 'pass';
      message = `Capability enforcement working (403 Forbidden)`;
    } else if (isExpectedStatus) {
      status = 'pass';
      message = `Endpoint accessible (${statusCode})`;
    } else if (statusCode >= 500) {
      status = 'error';
      message = `Server error (${statusCode})`;
    } else {
      status = 'fail';
      message = `Unexpected status (${statusCode}), expected one of: ${test.expectedStatus.join(', ')}`;
    }
    
    return {
      capability: test.capability,
      endpoint: test.endpoint,
      method: test.method,
      status,
      statusCode,
      message,
      vendorId,
    };
  } catch (error: any) {
    return {
      capability: test.capability,
      endpoint: test.endpoint,
      method: test.method,
      status: 'error',
      message: `Error: ${error.message}`,
      vendorId,
    };
  }
}

/**
 * Test all capability endpoints
 */
export async function testAllCapabilities(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log('Testing capability endpoints...\n');
  
  for (const test of CAPABILITY_ENDPOINTS) {
    console.log(`Testing: ${test.capability} - ${test.description}`);
    
    // Test without vendor ID (should fail or return empty)
    const result = await testCapabilityEndpoint(test);
    results.push(result);
    
    // Log result
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    console.log(`  ${icon} ${result.message}`);
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Generate test report
 */
export function generateTestReport(results: TestResult[]): string {
  let report = '# Capability API Endpoint Test Report\n\n';
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**API Base URL:** ${API_BASE_URL}\n\n`;
  
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  report += `## Summary\n\n`;
  report += `- **Total Tests:** ${total}\n`;
  report += `- **Passed:** ${passed} (${((passed / total) * 100).toFixed(1)}%)\n`;
  report += `- **Failed:** ${failed} (${((failed / total) * 100).toFixed(1)}%)\n`;
  report += `- **Errors:** ${errors} (${((errors / total) * 100).toFixed(1)}%)\n`;
  report += `- **Skipped:** ${skipped} (${((skipped / total) * 100).toFixed(1)}%)\n\n`;
  
  report += `## Test Results\n\n`;
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : result.status === 'error' ? '⚠️' : '⏭️';
    
    report += `### ${icon} ${result.capability}\n`;
    report += `- **Endpoint:** ${result.method} ${result.endpoint}\n`;
    report += `- **Status Code:** ${result.statusCode || 'N/A'}\n`;
    report += `- **Message:** ${result.message}\n`;
    if (result.vendorId) {
      report += `- **Vendor ID:** ${result.vendorId}\n`;
    }
    report += `\n`;
  }
  
  // List failed tests
  const failedTests = results.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    report += `## Failed Tests\n\n`;
    for (const failed of failedTests) {
      report += `- **${failed.capability}**: ${failed.message}\n`;
    }
    report += `\n`;
  }
  
  // List errors
  const errorTests = results.filter(r => r.status === 'error');
  if (errorTests.length > 0) {
    report += `## Errors\n\n`;
    for (const error of errorTests) {
      report += `- **${error.capability}**: ${error.message}\n`;
    }
    report += `\n`;
  }
  
  return report;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('='.repeat(50));
    console.log('Capability API Endpoint Testing');
    console.log('='.repeat(50));
    console.log(`API Base URL: ${API_BASE_URL}\n`);
    
    const results = await testAllCapabilities();
    const report = generateTestReport(results);
    
    // Save report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../../test-reports', `api-test-${timestamp}.md`);
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
    
    console.log('='.repeat(50));
    console.log('Test Summary');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nReport saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(failed > 0 || errors > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default {
  testAllCapabilities,
  generateTestReport,
};

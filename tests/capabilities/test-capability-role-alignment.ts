/**
 * Capability-Role Alignment Test Script
 * Tests that capabilities are correctly assigned to roles and enforced
 */

import { query, select } from '../../backend/lambda/src/database/rds-connection';
import { checkVendorCapability, getVendorCapabilities } from '../../backend/lambda/src/middleware/capability-enforcement';

// Expected role-capability mappings from role-seeding.ts
const EXPECTED_ROLE_CAPABILITIES: Record<string, string[]> = {
  'veterinarian': [
    'prescription',
    'medical_records',
    'booking',
    'chat',
    'staff_management',
    'tele',
    'emergency',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'vet_summary',
    'patient_monitoring'
  ],
  'veterinary_clinic': [
    'prescription',
    'medical_records',
    'booking',
    'chat',
    'staff_management',
    'tele',
    'emergency',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'vet_summary',
    'patient_monitoring',
    'multi_doctor_management',
    'ambulance_services',
    'diagnostic_lab',
    'emergency_protocols'
  ],
  'pet_groomer': [
    'booking',
    'portfolio',
    'gallery',
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management'
  ],
  'pet_boarding': [
    'booking',
    'cctv_access',
    'photo_updates',
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'room_management',
    'nightly_pricing',
    'occupancy_tracking'
  ],
  'pet_resort': [
    'booking',
    'cctv_access',
    'photo_updates',
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'room_management',
    'nightly_pricing',
    'occupancy_tracking'
  ],
  'pet_walker': [
    'gps_tracking',
    'photo_updates',
    'booking',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'chat'
  ],
  'pet_trainer': [
    'booking',
    'progress_tracking',
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management'
  ],
  'pet_behaviorist': [
    'booking',
    'progress_tracking',
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'tele'
  ],
  'pet_sitter': [
    'booking',
    'photo_updates',
    'chat',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'staff_management'
  ],
  'pet_taxi': [
    'booking',
    'gps_tracking',
    'emergency',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'distance_pricing',
    'chat'
  ],
  'pet_products_store': [
    'catalog',
    'inventory',
    'orders',
    'delivery',
    'staff_management',
    'facility_management',
    'schedule_management'
  ],
  'pet_pharmacy': [
    'catalog',
    'inventory',
    'prescription',
    'delivery',
    'staff_management',
    'facility_management',
    'schedule_management',
    'prescription_verification',
    'controlled_substances',
    'expiry_management'
  ],
  'pet_cafe': [
    'booking',
    'menu',
    'events',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'table_management',
    'pax_management',
    'chat'
  ],
  'pet_photographer': [
    'booking',
    'portfolio',
    'gallery',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'chat'
  ],
  'pet_shelter': [
    'adoption',
    'donation',
    'events',
    'staff_management',
    'facility_management',
    'schedule_management',
    'chat'
  ],
  'event_organizer': [
    'events',
    'booking',
    'staff_management',
    'facility_management',
    'schedule_management',
    'chat',
    'custom_services',
    'package_management'
  ],
  'pet_sunset_services': [
    'booking',
    'memorial',
    'counseling',
    'staff_management',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'chat'
  ],
  'nutritionist': [
    'booking',
    'chat',
    'staff_management',
    'tele',
    'facility_management',
    'schedule_management',
    'custom_services',
    'package_management',
    'meal_plans',
    'diet_charts',
    'progress_tracking'
  ],
  'insurance': [
    'chat',
    'staff_management',
    'facility_management',
    'schedule_management',
    'policy_management',
    'claims_management'
  ],
  'pet_ambulance': [
    'booking',
    'gps_tracking',
    'emergency',
    'facility_management',
    'schedule_management',
    'chat',
    'emergency_protocols'
  ],
  'pet_breeder': [
    'catalog',
    'booking',
    'chat',
    'facility_management',
    'schedule_management',
    'custom_services'
  ]
};

interface TestResult {
  role: string;
  capability: string;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  error?: string;
}

interface RoleTestResult {
  role: string;
  vendorId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
}

/**
 * Test capability-role alignment for a specific role
 */
export async function testRoleCapabilities(roleName: string): Promise<RoleTestResult> {
  const results: TestResult[] = [];
  
  // Get a vendor with this role
  const vendors = await select('vendors', { role: roleName });
  if (vendors.length === 0) {
    throw new Error(`No vendor found with role: ${roleName}`);
  }
  
  const vendorId = vendors[0].id;
  const expectedCapabilities = EXPECTED_ROLE_CAPABILITIES[roleName] || [];
  
  // Get actual capabilities
  const actualCapabilities = await getVendorCapabilities(vendorId);
  
  // Test each expected capability
  for (const capability of expectedCapabilities) {
    const hasCapability = await checkVendorCapability(vendorId, capability);
    const expected = true;
    const passed = hasCapability === expected;
    
    results.push({
      role: roleName,
      capability,
      expected,
      actual: hasCapability,
      passed,
    });
  }
  
  // Test that vendor doesn't have unexpected capabilities
  // (This is a basic check - full validation would require checking all possible capabilities)
  
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  
  return {
    role: roleName,
    vendorId,
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  };
}

/**
 * Test all roles for capability alignment
 */
export async function testAllRoleCapabilities(): Promise<RoleTestResult[]> {
  const allResults: RoleTestResult[] = [];
  
  for (const roleName of Object.keys(EXPECTED_ROLE_CAPABILITIES)) {
    try {
      const result = await testRoleCapabilities(roleName);
      allResults.push(result);
    } catch (error: any) {
      console.error(`Error testing role ${roleName}:`, error.message);
      allResults.push({
        role: roleName,
        vendorId: 'N/A',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        results: [{
          role: roleName,
          capability: 'N/A',
          expected: false,
          actual: false,
          passed: false,
          error: error.message,
        }],
      });
    }
  }
  
  return allResults;
}

/**
 * Generate test report
 */
export function generateTestReport(results: RoleTestResult[]): string {
  let report = '# Capability-Role Alignment Test Report\n\n';
  report += `**Date:** ${new Date().toISOString()}\n\n`;
  
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passedTests, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failedTests, 0);
  
  report += `## Summary\n\n`;
  report += `- **Total Roles Tested:** ${results.length}\n`;
  report += `- **Total Tests:** ${totalTests}\n`;
  report += `- **Passed:** ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(2)}%)\n`;
  report += `- **Failed:** ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(2)}%)\n\n`;
  
  report += `## Results by Role\n\n`;
  
  for (const result of results) {
    const passRate = result.totalTests > 0 
      ? ((result.passedTests / result.totalTests) * 100).toFixed(2)
      : '0.00';
    
    report += `### ${result.role}\n`;
    report += `- **Vendor ID:** ${result.vendorId}\n`;
    report += `- **Tests:** ${result.passedTests}/${result.totalTests} passed (${passRate}%)\n`;
    
    if (result.failedTests > 0) {
      report += `\n**Failed Capabilities:**\n`;
      for (const testResult of result.results) {
        if (!testResult.passed) {
          report += `- ❌ ${testResult.capability}: Expected ${testResult.expected}, Got ${testResult.actual}`;
          if (testResult.error) {
            report += ` (Error: ${testResult.error})`;
          }
          report += `\n`;
        }
      }
    }
    
    report += `\n`;
  }
  
  // List all failed tests
  const failedTests = results.flatMap(r => 
    r.results.filter(t => !t.passed).map(t => ({ role: r.role, ...t }))
  );
  
  if (failedTests.length > 0) {
    report += `## Failed Tests Summary\n\n`;
    for (const failed of failedTests) {
      report += `- **${failed.role}** → ${failed.capability}: Expected ${failed.expected}, Got ${failed.actual}\n`;
    }
  }
  
  return report;
}

// Export for use in test scripts
export default {
  testRoleCapabilities,
  testAllRoleCapabilities,
  generateTestReport,
};

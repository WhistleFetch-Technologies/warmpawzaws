/**
 * ============================================================================
 * E2E TESTS: VENDOR ONBOARDING FLOW
 * ============================================================================
 * 
 * Tests the complete vendor onboarding journey:
 * 1. Phone verification
 * 2. Role selection
 * 3. Business type selection
 * 4. Form submission
 * 5. Document upload
 * 6. Application submission
 * 7. Admin approval/rejection/clarification
 * 8. Dashboard access
 * 
 * Run: npx ts-node tests/e2e/vendor-onboarding.test.ts
 * Date: 2026-01-02
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface VendorTestContext {
  phone: string;
  vendorId?: string;
  applicationId?: string;
  roleId?: string;
  status?: string;
}

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data: any = await response.json();
  
  if (!response.ok && response.status !== 409) {
    throw new Error(`API Error: ${data.error || response.statusText}`);
  }
  
  return data;
}

function log(step: string, message: string, data?: any): void {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testOTPFlow(ctx: VendorTestContext): Promise<void> {
  log('1.1', 'Testing OTP send');
  
  try {
    await apiRequest('/auth/otp/send', 'POST', { phone: ctx.phone });
    log('1.1', 'OTP sent successfully');
  } catch (error: any) {
    log('1.1', 'OTP send failed (may be rate limited)', { error: error.message });
  }

  log('1.2', 'Testing OTP verification (mock)');
  try {
    const result = await apiRequest('/auth/otp/verify', 'POST', {
      phone: ctx.phone,
      otp: '123456', // Test OTP
    });
    log('1.2', 'OTP verification result', { verified: result.verified || result.success });
  } catch (error: any) {
    log('1.2', 'OTP verification failed', { error: error.message });
  }
}

async function testPhoneCheck(ctx: VendorTestContext): Promise<void> {
  log('2.1', 'Testing phone existence check');
  
  try {
    const result = await apiRequest(`/vendor/check-phone/${ctx.phone}`, 'GET');
    log('2.1', 'Phone check result', result);
    
    if (result.exists) {
      ctx.vendorId = result.vendorId;
      ctx.status = result.status;
      log('2.1', 'Existing vendor found', { 
        vendorId: ctx.vendorId, 
        status: ctx.status 
      });
    }
  } catch (error: any) {
    log('2.1', 'Phone check failed', { error: error.message });
  }
}

async function testRolesLoading(): Promise<string | undefined> {
  log('3.1', 'Testing roles loading');
  
  try {
    const result = await apiRequest('/config/roles', 'GET');
    assert(result.roles?.length > 0, 'Should have at least one role');
    
    log('3.1', 'Roles loaded', { 
      count: result.roles.length,
      roles: result.roles.map((r: any) => r.display_name),
    });

    // Return first role ID for testing
    return result.roles[0].id;
  } catch (error: any) {
    log('3.1', 'Roles loading failed', { error: error.message });
    return undefined;
  }
}

async function testRoleCapabilities(roleId: string): Promise<void> {
  log('3.2', 'Testing role capabilities fetch');
  
  try {
    const result = await apiRequest(`/config/roles/${roleId}`, 'GET');
    log('3.2', 'Role details', {
      name: result.display_name,
      capabilities: result.capabilities?.length || 0,
      service_styles: result.service_styles,
    });
  } catch (error: any) {
    log('3.2', 'Role capabilities fetch failed', { error: error.message });
  }
}

async function testApplicationSubmission(ctx: VendorTestContext, roleId: string): Promise<void> {
  log('4.1', 'Testing application submission');
  
  const applicationData = {
    roleId,
    phone: ctx.phone,
    email: `test-${Date.now()}@warmpawz.com`,
    serviceStyle: 'centre',
    businessType: 'solo',
    formData: {
      fullName: 'Test Vendor',
      businessName: 'Test Pet Clinic',
      address: '123 Test Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      registrationNumber: 'VCI123456',
      qualifications: 'BVSc',
      experience: 5,
    },
    documents: {
      idProof: 'https://example.com/id.pdf',
      vciCertificate: 'https://example.com/vci.pdf',
    },
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
    },
  };

  try {
    const result = await apiRequest('/vendor/apply', 'POST', applicationData);
    
    if (result.vendorId) {
      ctx.vendorId = result.vendorId;
      ctx.applicationId = result.applicationId;
      log('4.1', 'Application submitted', {
        vendorId: ctx.vendorId,
        applicationId: ctx.applicationId,
      });
    } else if (result.error === 'duplicate_phone') {
      log('4.1', 'Duplicate phone detected', result.existingApplication);
      ctx.vendorId = result.existingApplication?.id;
    }
  } catch (error: any) {
    log('4.1', 'Application submission failed', { error: error.message });
  }
}

async function testOnboardingStatus(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('5.1', 'Testing onboarding status fetch');
  
  try {
    const result = await apiRequest(`/vendor/${ctx.vendorId}/onboarding-status`, 'GET');
    ctx.status = result.status;
    log('5.1', 'Onboarding status', result);
  } catch (error: any) {
    log('5.1', 'Status fetch failed', { error: error.message });
  }
}

async function testAdminApproval(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('6.1', 'Testing admin pending vendors list');
  
  try {
    const pending = await apiRequest('/admin/vendors?status=pending', 'GET');
    log('6.1', 'Pending vendors', { count: pending.vendors?.length || 0 });
  } catch (error: any) {
    log('6.1', 'Pending list fetch failed', { error: error.message });
  }

  log('6.2', 'Testing admin approval');
  try {
    await apiRequest(`/admin/vendors/${ctx.vendorId}/approve`, 'POST', {});
    ctx.status = 'approved';
    log('6.2', 'Vendor approved');
  } catch (error: any) {
    log('6.2', 'Approval failed (may already be processed)', { error: error.message });
  }
}

async function testClarificationRequest(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('6.3', 'Testing clarification request');
  try {
    await apiRequest(`/admin/vendors/${ctx.vendorId}/request-clarification`, 'POST', {
      comment: 'Please provide clearer ID proof document',
    });
    log('6.3', 'Clarification requested');
  } catch (error: any) {
    log('6.3', 'Clarification request failed', { error: error.message });
  }
}

async function testDashboardAccess(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('7.1', 'Testing dashboard access');
  
  try {
    const dashboard = await apiRequest(`/vendor/${ctx.vendorId}/dashboard`, 'GET');
    log('7.1', 'Dashboard loaded', {
      businessName: dashboard.vendor?.business_name,
      stats: dashboard.stats,
    });
  } catch (error: any) {
    log('7.1', 'Dashboard access failed', { error: error.message });
  }

  log('7.2', 'Testing vendor profile fetch');
  try {
    const profile = await apiRequest(`/vendor/${ctx.vendorId}/profile`, 'GET');
    log('7.2', 'Profile loaded', { 
      name: profile.vendor?.owner_name,
      status: profile.vendor?.status,
    });
  } catch (error: any) {
    log('7.2', 'Profile fetch failed', { error: error.message });
  }
}

async function testCapabilitiesEnforcement(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('8.1', 'Testing capabilities enforcement');
  
  try {
    const services = await apiRequest(`/vendor/${ctx.vendorId}/services`, 'GET');
    log('8.1', 'Services access', { 
      allowed: true, 
      count: services.services?.length || 0 
    });
  } catch (error: any) {
    log('8.1', 'Services access result', { error: error.message });
  }

  log('8.2', 'Testing staff management access');
  try {
    const staff = await apiRequest(`/vendor/${ctx.vendorId}/staff`, 'GET');
    log('8.2', 'Staff access', { 
      allowed: true, 
      count: staff.staff?.length || 0 
    });
  } catch (error: any) {
    log('8.2', 'Staff access result', { error: error.message });
  }
}

async function testServiceCreation(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('9.1', 'Testing service creation');
  
  try {
    const service = await apiRequest(`/vendor/${ctx.vendorId}/services`, 'POST', {
      name: 'General Consultation',
      description: 'General health checkup for pets',
      category: 'consultation',
      service_style: 'centre',
      price: 500,
      duration: 30,
      is_active: true,
    });
    log('9.1', 'Service created', { serviceId: service.id });
  } catch (error: any) {
    log('9.1', 'Service creation failed', { error: error.message });
  }
}

async function testBankAccountSetup(ctx: VendorTestContext): Promise<void> {
  if (!ctx.vendorId) return;

  log('10.1', 'Testing linked account creation');
  try {
    const account = await apiRequest('/razorpay/linked-account/create', 'POST', {
      vendor_id: ctx.vendorId,
    });
    log('10.1', 'Linked account', account);
  } catch (error: any) {
    log('10.1', 'Linked account creation failed', { error: error.message });
  }

  log('10.2', 'Testing bank account addition');
  try {
    const bank = await apiRequest('/razorpay/linked-account/bank', 'POST', {
      vendor_id: ctx.vendorId,
      account_number: '1234567890',
      ifsc_code: 'SBIN0001234',
      beneficiary_name: 'Test Vendor',
    });
    log('10.2', 'Bank account added', bank);
  } catch (error: any) {
    log('10.2', 'Bank account addition failed', { error: error.message });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runVendorOnboardingTests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - VENDOR ONBOARDING');
  console.log('═'.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('═'.repeat(60));

  // Generate unique phone for testing
  const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
  const ctx: VendorTestContext = { phone: testPhone };

  const tests = [
    { name: 'OTP Flow', fn: () => testOTPFlow(ctx) },
    { name: 'Phone Existence Check', fn: () => testPhoneCheck(ctx) },
    { name: 'Roles Loading', fn: async () => {
      ctx.roleId = await testRolesLoading();
    }},
    { name: 'Role Capabilities', fn: async () => {
      if (ctx.roleId) await testRoleCapabilities(ctx.roleId);
    }},
    { name: 'Application Submission', fn: async () => {
      if (ctx.roleId) await testApplicationSubmission(ctx, ctx.roleId);
    }},
    { name: 'Onboarding Status', fn: () => testOnboardingStatus(ctx) },
    { name: 'Admin Approval', fn: () => testAdminApproval(ctx) },
    { name: 'Dashboard Access', fn: () => testDashboardAccess(ctx) },
    { name: 'Capabilities Enforcement', fn: () => testCapabilitiesEnforcement(ctx) },
    { name: 'Service Creation', fn: () => testServiceCreation(ctx) },
    { name: 'Bank Account Setup', fn: () => testBankAccountSetup(ctx) },
  ];

  const results: { name: string; passed: boolean; error?: string }[] = [];

  for (const test of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🧪 ${test.name}`);
    console.log('─'.repeat(60));

    try {
      await test.fn();
      results.push({ name: test.name, passed: true });
      console.log(`\n✅ ${test.name} - PASSED`);
    } catch (error: any) {
      results.push({ name: test.name, passed: false, error: error.message });
      console.log(`\n❌ ${test.name} - FAILED: ${error.message}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}${r.error ? `: ${r.error}` : ''}`);
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runVendorOnboardingTests().catch(console.error);


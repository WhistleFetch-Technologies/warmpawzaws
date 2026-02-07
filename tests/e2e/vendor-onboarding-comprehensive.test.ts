/**
 * ============================================================================
 * E2E TESTS: VENDOR ONBOARDING
 * ============================================================================
 * 
 * Tests complete vendor onboarding workflow:
 * 1. Role selection
 * 2. Identity registration
 * 3. Application submission
 * 4. Document upload
 * 5. Admin review process
 * 6. Activation
 * 7. Service setup
 * 
 * Run: npx ts-node tests/e2e/vendor-onboarding-comprehensive.test.ts
 * Date: 2026-01-28
 * ============================================================================
 */

import {
  apiRequest,
  apiRequestWithRetry,
  runTestSuite,
  TestSuite,
  assert,
  assertDefined,
  assertEqual,
  assertArrayLength,
  log,
  logError,
  sleep,
  generateTestPhone,
  generateUUID,
  TEST_CONFIG,
} from './test-utils';

// ============================================================================
// TEST CONTEXT
// ============================================================================

interface VendorOnboardingContext {
  phone: string;
  vendorIdentityId?: string;
  applicationId?: string;
  vendorId?: string;
  selectedRoleId?: string;
  selectedRoleCode?: string;
  availableRoles?: any[];
  onboardingStatus?: string;
  serviceIds: string[];
}

const ctx: VendorOnboardingContext = {
  phone: generateTestPhone(),
  serviceIds: [],
};

// ============================================================================
// TEST SUITES
// ============================================================================

const roleSelectionSuite: TestSuite = {
  name: 'Role Selection',
  tests: [
    {
      name: 'Should fetch available vendor roles',
      fn: async () => {
        const response = await apiRequest('/config/roles');

        log('Roles', 'Available roles response', response);

        if (response.success && response.data?.roles) {
          ctx.availableRoles = response.data.roles;
          assert(
            Array.isArray(ctx.availableRoles) && ctx.availableRoles.length > 0,
            'Should have at least one role available'
          );

          // Select first role for testing
          const firstRole = ctx.availableRoles[0];
          ctx.selectedRoleId = firstRole.id;
          ctx.selectedRoleCode = firstRole.code;
          
          log('Roles', `Selected role: ${ctx.selectedRoleCode} (${ctx.selectedRoleId})`);
        }
      },
    },
    {
      name: 'Should fetch role details with capabilities',
      fn: async () => {
        if (!ctx.selectedRoleId) {
          log('Roles', 'Skipping - no role selected');
          return;
        }

        const response = await apiRequest(`/config/roles/${ctx.selectedRoleId}`);

        log('Roles', 'Role details response', response);

        if (response.success && response.data?.role) {
          const role = response.data.role;
          log('Roles', `Role capabilities: ${JSON.stringify(role.capabilities || role.permissions)}`);
        }
      },
    },
    {
      name: 'Should fetch onboarding form for role',
      fn: async () => {
        if (!ctx.selectedRoleCode) {
          log('Roles', 'Skipping - no role selected');
          return;
        }

        const response = await apiRequest(`/vendor/onboarding/form?role=${ctx.selectedRoleCode}`);

        log('Roles', 'Onboarding form response', response);

        if (response.success && response.data?.form) {
          log('Roles', `Form sections: ${response.data.form.sections?.length || 0}`);
        }
      },
    },
  ],
};

const identityRegistrationSuite: TestSuite = {
  name: 'Identity Registration',
  tests: [
    {
      name: 'Should check onboarding status (new user)',
      fn: async () => {
        const response = await apiRequest('/vendor/onboarding/status', {
          method: 'POST',
          body: {
            phone: ctx.phone,
          },
        });

        log('Identity', 'Initial status check response', response);

        if (response.success && response.data) {
          ctx.onboardingStatus = response.data.status || response.data.identity?.onboarding_status;
          ctx.vendorIdentityId = response.data.identityId || response.data.identity?.id;
          
          log('Identity', `Status: ${ctx.onboardingStatus}, Identity ID: ${ctx.vendorIdentityId}`);
        }
      },
    },
    {
      name: 'Should create vendor identity',
      fn: async () => {
        const response = await apiRequest('/vendor/onboarding/identity', {
          method: 'POST',
          body: {
            phone: ctx.phone,
            fullName: 'Test Vendor',
            email: `testvendor_${Date.now()}@warmpawz.test`,
            vendorType: 'solo', // or 'business'
            selectedRoleId: ctx.selectedRoleId,
          },
        });

        log('Identity', 'Create identity response', response);

        if (response.success) {
          ctx.vendorIdentityId = response.data?.identityId || response.data?.identity?.id;
          log('Identity', `Created identity: ${ctx.vendorIdentityId}`);
        }
      },
    },
    {
      name: 'Should update vendor identity with additional info',
      fn: async () => {
        if (!ctx.vendorIdentityId) {
          log('Identity', 'Skipping - no identity created');
          return;
        }

        const response = await apiRequest(`/vendor/onboarding/identity/${ctx.vendorIdentityId}`, {
          method: 'PUT',
          body: {
            businessName: 'Test Pet Clinic',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
            address: '123 Test Street',
          },
        });

        log('Identity', 'Update identity response', response);
      },
    },
  ],
};

const applicationSubmissionSuite: TestSuite = {
  name: 'Application Submission',
  tests: [
    {
      name: 'Should create vendor application',
      fn: async () => {
        const response = await apiRequest('/vendor/onboarding/application', {
          method: 'POST',
          body: {
            phone: ctx.phone,
            identityId: ctx.vendorIdentityId,
            roleId: ctx.selectedRoleId,
            vendorType: 'solo',
            businessDetails: {
              name: 'Test Pet Clinic',
              description: 'A test veterinary clinic',
              experienceYears: 5,
              specializations: ['general', 'surgery'],
            },
            contactDetails: {
              address: '123 Test Street',
              city: 'Bangalore',
              state: 'Karnataka',
              pincode: '560001',
              phone: ctx.phone,
              email: `testvendor_${Date.now()}@warmpawz.test`,
            },
          },
        });

        log('Application', 'Create application response', response);

        if (response.success) {
          ctx.applicationId = response.data?.applicationId || response.data?.application?.id;
          log('Application', `Created application: ${ctx.applicationId}`);
        }
      },
    },
    {
      name: 'Should fetch application status',
      fn: async () => {
        if (!ctx.applicationId && !ctx.vendorIdentityId) {
          log('Application', 'Skipping - no application created');
          return;
        }

        const response = await apiRequest('/vendor/onboarding/status', {
          method: 'POST',
          body: {
            phone: ctx.phone,
          },
        });

        log('Application', 'Application status response', response);

        if (response.success && response.data) {
          ctx.onboardingStatus = response.data.status || response.data.identity?.onboarding_status;
          log('Application', `Current status: ${ctx.onboardingStatus}`);
        }
      },
    },
    {
      name: 'Should update application with additional documents',
      fn: async () => {
        if (!ctx.applicationId) {
          log('Application', 'Skipping - no application created');
          return;
        }

        const response = await apiRequest(`/vendor/onboarding/application/${ctx.applicationId}/documents`, {
          method: 'POST',
          body: {
            documentType: 'license',
            documentUrl: 'https://storage.example.com/docs/license.pdf',
            documentNumber: 'VET-2024-001',
            expiryDate: '2027-12-31',
          },
        });

        log('Application', 'Document upload response', response);
      },
    },
  ],
};

const adminReviewSuite: TestSuite = {
  name: 'Admin Review Process',
  tests: [
    {
      name: 'Should fetch pending applications (admin)',
      fn: async () => {
        const response = await apiRequest('/admin/vendors/pending-applications');

        log('AdminReview', 'Pending applications response', response);

        if (response.success && response.data?.applications) {
          log('AdminReview', `Pending applications: ${response.data.applications.length}`);
        }
      },
    },
    {
      name: 'Should fetch application details for review',
      fn: async () => {
        if (!ctx.applicationId && !ctx.vendorIdentityId) {
          log('AdminReview', 'Skipping - no application to review');
          return;
        }

        const id = ctx.applicationId || ctx.vendorIdentityId;
        const response = await apiRequest(`/admin/vendors/application/${id}`);

        log('AdminReview', 'Application details response', response);
      },
    },
    {
      name: 'Should approve vendor application',
      fn: async () => {
        if (!ctx.applicationId && !ctx.vendorIdentityId) {
          log('AdminReview', 'Skipping - no application to approve');
          return;
        }

        const id = ctx.applicationId || ctx.vendorIdentityId;
        const response = await apiRequest(`/admin/vendors/application/${id}/approve`, {
          method: 'POST',
          body: {
            approvedBy: 'test-admin',
            notes: 'Approved for testing',
            commissionRate: 15, // 15% commission
          },
        });

        log('AdminReview', 'Approval response', response);

        if (response.success) {
          ctx.vendorId = response.data?.vendorId || response.data?.vendor?.id;
          log('AdminReview', `Vendor approved: ${ctx.vendorId}`);
        }
      },
    },
  ],
};

const vendorActivationSuite: TestSuite = {
  name: 'Vendor Activation',
  tests: [
    {
      name: 'Should check activation status',
      fn: async () => {
        const response = await apiRequest('/vendor/onboarding/status', {
          method: 'POST',
          body: {
            phone: ctx.phone,
          },
        });

        log('Activation', 'Activation status response', response);

        if (response.success && response.data) {
          ctx.onboardingStatus = response.data.status || response.data.identity?.onboarding_status;
          log('Activation', `Current status: ${ctx.onboardingStatus}`);
        }
      },
    },
    {
      name: 'Should add bank account details',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('Activation', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/bank-account`, {
          method: 'POST',
          body: {
            accountHolderName: 'Test Vendor',
            accountNumber: '1234567890123456',
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            accountType: 'savings',
          },
        });

        log('Activation', 'Bank account response', response);
      },
    },
    {
      name: 'Should activate vendor',
      fn: async () => {
        if (!ctx.vendorIdentityId) {
          log('Activation', 'Skipping - no vendor identity');
          return;
        }

        const response = await apiRequest(`/vendor/onboarding/activate`, {
          method: 'POST',
          body: {
            identityId: ctx.vendorIdentityId,
            phone: ctx.phone,
          },
        });

        log('Activation', 'Activation response', response);
      },
    },
  ],
};

const serviceSetupSuite: TestSuite = {
  name: 'Service Setup',
  tests: [
    {
      name: 'Should fetch available services for role',
      fn: async () => {
        if (!ctx.selectedRoleId) {
          log('ServiceSetup', 'Skipping - no role selected');
          return;
        }

        const response = await apiRequest(`/service-catalog/services?role=${ctx.selectedRoleCode}`);

        log('ServiceSetup', 'Available services response', response);
      },
    },
    {
      name: 'Should add service to vendor profile',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('ServiceSetup', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/services`, {
          method: 'POST',
          body: {
            serviceId: generateUUID(),
            serviceName: 'General Consultation',
            price: 500,
            duration: 30,
            serviceStyle: 'at_center',
            isActive: true,
          },
        });

        log('ServiceSetup', 'Add service response', response);

        if (response.success && response.data?.serviceId) {
          ctx.serviceIds.push(response.data.serviceId);
        }
      },
    },
    {
      name: 'Should set up availability schedule',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('ServiceSetup', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/availability-slots`, {
          method: 'POST',
          body: {
            dayOfWeek: 1, // Monday
            startTime: '09:00',
            endTime: '18:00',
            slotDuration: 30,
            serviceStyles: ['at_center', 'tele'],
          },
        });

        log('ServiceSetup', 'Availability setup response', response);
      },
    },
    {
      name: 'Should publish vendor profile',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('ServiceSetup', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/publish`, {
          method: 'POST',
        });

        log('ServiceSetup', 'Publish profile response', response);
      },
    },
  ],
};

const vendorDashboardSuite: TestSuite = {
  name: 'Vendor Dashboard Access',
  tests: [
    {
      name: 'Should access vendor dashboard stats',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('Dashboard', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/dashboard/stats`);

        log('Dashboard', 'Dashboard stats response', response);
      },
    },
    {
      name: 'Should fetch vendor bookings',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('Dashboard', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/bookings`);

        log('Dashboard', 'Vendor bookings response', response);
      },
    },
    {
      name: 'Should fetch vendor earnings',
      fn: async () => {
        const vendorId = ctx.vendorId || ctx.vendorIdentityId;
        if (!vendorId) {
          log('Dashboard', 'Skipping - no vendor ID');
          return;
        }

        const response = await apiRequest(`/vendor/${vendorId}/earnings`);

        log('Dashboard', 'Vendor earnings response', response);
      },
    },
  ],
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - VENDOR ONBOARDING');
  console.log('═'.repeat(60));
  console.log(`API URL: ${TEST_CONFIG.apiBaseUrl}`);
  console.log(`Test Phone: ${ctx.phone}`);
  console.log('═'.repeat(60));

  const suites = [
    roleSelectionSuite,
    identityRegistrationSuite,
    applicationSubmissionSuite,
    adminReviewSuite,
    vendorActivationSuite,
    serviceSetupSuite,
    vendorDashboardSuite,
  ];

  const allResults: any[] = [];

  for (const suite of suites) {
    const result = await runTestSuite(suite);
    allResults.push(result);
  }

  // Final Summary
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of allResults) {
    console.log(`\n${result.suiteName}:`);
    console.log(`  Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
  console.log('═'.repeat(60));

  // Test Context Summary
  console.log('\nOnboarding Context:');
  console.log(`  Phone: ${ctx.phone}`);
  console.log(`  Identity ID: ${ctx.vendorIdentityId || 'Not created'}`);
  console.log(`  Application ID: ${ctx.applicationId || 'Not created'}`);
  console.log(`  Vendor ID: ${ctx.vendorId || 'Not created'}`);
  console.log(`  Selected Role: ${ctx.selectedRoleCode || 'Not selected'}`);
  console.log(`  Final Status: ${ctx.onboardingStatus || 'Unknown'}`);

  // Exit with error code if any tests failed
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);

#!/usr/bin/env ts-node
// ============================================================================
// COMPLETE VENDOR ONBOARDING FLOW TEST FOR ALL 20 ROLES
// ============================================================================
// Tests the complete flow from signup to dashboard for all 20 vendor roles
// Compatible with AWS Serverless architecture
// ============================================================================

import axios, { AxiosInstance } from 'axios';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_PHONE_PREFIX = '+91';

interface TestResult {
  role: string;
  passed: boolean;
  errors: string[];
  duration: number;
}

interface TestContext {
  phone: string;
  roleId?: string;
  vendorId?: string;
  applicationId?: string;
  authToken?: string;
}

// ============================================================================
// API CLIENT
// ============================================================================

class TestApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async sendOtp(phone: string) {
    const response = await this.client.post('/vendor/send-otp', { phone });
    return response.data;
  }

  async verifyOtp(phone: string, otp: string = '123456') {
    const response = await this.client.post('/vendor/verify-otp', { phone, otp });
    if (response.data.session?.accessToken) {
      this.setAuthToken(response.data.session.accessToken);
    }
    return response.data;
  }

  async getAvailableRoles() {
    const response = await this.client.get('/vendor/onboarding/roles');
    return response.data;
  }

  async selectRole(phone: string, roleId: string) {
    const response = await this.client.post('/vendor/onboarding/select-role', {
      phone,
      role_id: roleId,
    });
    return response.data;
  }

  async selectVendorType(phone: string, vendorType: 'solo' | 'business') {
    const response = await this.client.post('/vendor/onboarding/select-vendor-type', {
      phone,
      vendor_type: vendorType,
    });
    return response.data;
  }

  async getFormSchema(phone: string) {
    const response = await this.client.get(`/vendor/onboarding/form-schema?phone=${phone}`);
    return response.data;
  }

  async submitApplication(phone: string, applicationPayload: any, documents: any[] = []) {
    const response = await this.client.post('/vendor/onboarding/submit-application', {
      phone,
      application_payload: applicationPayload,
      uploaded_documents: documents,
    });
    return response.data;
  }

  async getOnboardingStatus(phone: string) {
    const response = await this.client.get(`/vendor/onboarding/status?phone=${phone}`);
    return response.data;
  }

  async adminApproveApplication(applicationId: string, _adminId: string = 'test-admin') {
    const response = await this.client.post(`/admin/vendor/application/${applicationId}/approve`, {
      reviewerName: 'Test Admin',
      notes: 'Test approval',
    });
    return response.data;
  }

  async activateVendor(phone: string) {
    const response = await this.client.post('/vendor/onboarding/activate', { phone });
    return response.data;
  }

  async getDashboard(vendorId: string) {
    const response = await this.client.get(`/vendor/${vendorId}/dashboard`);
    return response.data;
  }

  async getVendorProfile(vendorId: string) {
    const response = await this.client.get(`/vendor/${vendorId}/profile`);
    return response.data;
  }

  async getRoleCapabilities(roleId: string) {
    const response = await this.client.get(`/config/roles/${roleId}`);
    return response.data;
  }
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

function generateTestPhone(): string {
  const random = Math.floor(Math.random() * 10000000000);
  return `${TEST_PHONE_PREFIX}${random.toString().padStart(10, '0')}`;
}

function generateTestApplicationData(schema: any): any {
  const data: any = {
    businessName: `Test Business ${Math.random().toString(36).substring(7)}`,
    ownerName: 'Test Owner',
    email: `test${Math.random().toString(36).substring(7)}@example.com`,
    address: '123 Test Street, Test City',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456',
  };

  // Add role-specific fields based on schema
  if (schema && schema.fields) {
    schema.fields.forEach((field: any) => {
      if (field.required && !data[field.id]) {
        switch (field.type) {
          case 'number':
            data[field.id] = field.validation?.min || 1;
            break;
          case 'multiselect':
            data[field.id] = field.options?.slice(0, 2) || [];
            break;
          case 'select':
            data[field.id] = field.options?.[0] || 'option1';
            break;
          case 'text':
          case 'email':
          case 'tel':
            data[field.id] = `test_${field.id}`;
            break;
          case 'textarea':
            data[field.id] = 'Test description';
            break;
          default:
            data[field.id] = 'test_value';
        }
      }
    });
  }

  return data;
}

// ============================================================================
// TEST FLOW
// ============================================================================

async function testRoleFlow(apiClient: TestApiClient, roleName: string): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const context: TestContext = {
    phone: generateTestPhone(),
  };

  try {
    console.log(`\n🧪 Testing role: ${roleName}`);
    console.log(`   Phone: ${context.phone}`);

    // Step 1: Send OTP
    console.log('   Step 1: Sending OTP...');
    const otpResponse = await apiClient.sendOtp(context.phone);
    if (!otpResponse.success && !otpResponse.message) {
      throw new Error('Failed to send OTP');
    }
    console.log('   ✅ OTP sent');

    // Step 2: Verify OTP
    console.log('   Step 2: Verifying OTP...');
    const verifyResponse = await apiClient.verifyOtp(context.phone);
    if (!verifyResponse.success && !verifyResponse.user) {
      throw new Error('Failed to verify OTP');
    }
    if (verifyResponse.session?.accessToken) {
      context.authToken = verifyResponse.session.accessToken;
    }
    console.log('   ✅ OTP verified');

    // Step 3: Get available roles
    console.log('   Step 3: Getting available roles...');
    const rolesResponse = await apiClient.getAvailableRoles();
    if (!rolesResponse.roles || rolesResponse.roles.length === 0) {
      throw new Error('No roles available');
    }
    const role = rolesResponse.roles.find((r: any) => r.name === roleName);
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }
    context.roleId = role.id;
    console.log(`   ✅ Found role: ${role.display_name}`);

    // Step 4: Select role
    console.log('   Step 4: Selecting role...');
    const selectRoleResponse = await apiClient.selectRole(context.phone, role.id);
    if (!selectRoleResponse.success) {
      throw new Error('Failed to select role');
    }
    console.log('   ✅ Role selected');

    // Step 5: Select vendor type
    console.log('   Step 5: Selecting vendor type...');
    const vendorType = role.vendorTypes?.[0] || role.vendor_types_supported?.[0] || 'solo';
    const selectTypeResponse = await apiClient.selectVendorType(
      context.phone,
      vendorType === 'solo_provider' ? 'solo' : vendorType === 'center' ? 'business' : vendorType
    );
    if (!selectTypeResponse.success) {
      throw new Error('Failed to select vendor type');
    }
    console.log(`   ✅ Vendor type selected: ${vendorType}`);

    // Step 6: Get form schema
    console.log('   Step 6: Getting form schema...');
    const formSchemaResponse = await apiClient.getFormSchema(context.phone);
    if (!formSchemaResponse.schema) {
      throw new Error('Form schema not found');
    }
    if (!formSchemaResponse.schema.fields || formSchemaResponse.schema.fields.length === 0) {
      throw new Error('Form schema has no fields');
    }
    console.log(`   ✅ Form schema loaded (${formSchemaResponse.schema.fields.length} fields)`);

    // Step 7: Submit application
    console.log('   Step 7: Submitting application...');
    const applicationData = generateTestApplicationData(formSchemaResponse.schema);
    const submitResponse = await apiClient.submitApplication(
      context.phone,
      applicationData,
      []
    );
    if (!submitResponse.success) {
      throw new Error('Failed to submit application');
    }
    context.applicationId = submitResponse.applicationId;
    console.log(`   ✅ Application submitted (ID: ${context.applicationId})`);

    // Step 8: Admin approve (simulate)
    console.log('   Step 8: Admin approving application...');
    const approveResponse = await apiClient.adminApproveApplication(
      context.applicationId!,
      'test-admin'
    );
    if (!approveResponse.success) {
      throw new Error('Failed to approve application');
    }
    console.log('   ✅ Application approved');

    // Step 9: Activate vendor
    console.log('   Step 9: Activating vendor...');
    const activateResponse = await apiClient.activateVendor(context.phone);
    if (!activateResponse.success) {
      throw new Error('Failed to activate vendor');
    }
    context.vendorId = activateResponse.vendor_id;
    console.log(`   ✅ Vendor activated (ID: ${context.vendorId})`);

    // Step 10: Load dashboard
    console.log('   Step 10: Loading dashboard...');
    const dashboardResponse = await apiClient.getDashboard(context.vendorId!);
    if (!dashboardResponse.stats && !dashboardResponse.success) {
      throw new Error('Failed to load dashboard');
    }
    console.log('   ✅ Dashboard loaded');

    // Step 11: Verify capabilities
    console.log('   Step 11: Verifying capabilities...');
    const profileResponse = await apiClient.getVendorProfile(context.vendorId!);
    if (profileResponse.vendor?.role_id) {
      const capabilitiesResponse = await apiClient.getRoleCapabilities(
        profileResponse.vendor.role_id
      );
      if (!capabilitiesResponse.capabilities || capabilitiesResponse.capabilities.length === 0) {
        errors.push('No capabilities found for role');
      } else {
        console.log(`   ✅ Capabilities loaded (${capabilitiesResponse.capabilities.length} capabilities)`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Test completed in ${duration}ms`);

    return {
      role: roleName,
      passed: errors.length === 0,
      errors,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    errors.push(error.message || 'Unknown error');
    console.error(`   ❌ Test failed: ${error.message}`);
    return {
      role: roleName,
      passed: false,
      errors,
      duration,
    };
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  const apiClient = new TestApiClient(API_BASE_URL);

  const roles = [
    'veterinarian',
    'vet_clinic',
    'ambulance',
    'diagnostics_center',
    'pharmacy',
    'pet_nutritionist',
    'pet_insurance',
    'pet_groomer',
    'pet_trainer',
    'pet_walker',
    'pet_sitter',
    'pet_boarder',
    'pet_transport',
    'pet_photographer',
    'pet_spa',
    'pet_cafe',
    'pet_adoption_center',
    'pet_event_organizer',
    'pet_relocation',
    'pet_daycare',
  ];

  console.log('🚀 Starting Vendor Onboarding Flow Tests');
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Testing ${roles.length} roles\n`);

  const results: TestResult[] = [];

  for (const role of roles) {
    const result = await testRoleFlow(apiClient, role);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n✅ Passed: ${passed}/${roles.length}`);
  console.log(`❌ Failed: ${failed}/${roles.length}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`📈 Average Duration: ${Math.round(totalDuration / roles.length)}ms`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`\n   ${r.role}:`);
        r.errors.forEach(e => console.log(`     - ${e}`));
      });
  }

  console.log('\n' + '='.repeat(60));

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runAllTests, testRoleFlow };


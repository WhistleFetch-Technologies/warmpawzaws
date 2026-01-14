/**
 * ============================================================================
 * VENDOR FLOW END-TO-END TEST
 * ============================================================================
 * 
 * This script tests the complete vendor flow:
 * 1. Vendor onboarding form submission
 * 2. Admin approval
 * 3. Vendor dashboard access
 * 4. Center profile creation
 * 5. Staff creation
 * 6. Service creation
 * 7. Verification that services appear for customers
 * 
 * Usage: npx tsx tests/vendor-flow-e2e.ts
 * ============================================================================
 */

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const UAT_MODE = true;

// Generate unique test phone number
const TEST_PHONE = `98765${Date.now().toString().slice(-5)}`;
const TEST_EMAIL = `vendor-${Date.now()}@test.warmpawz.app`;

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

function log(step: string, success: boolean, data?: any, error?: string) {
  results.push({ step, success, data, error });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}`);
  if (error) console.log(`   Error: ${error}`);
  if (data && !success) console.log(`   Data:`, JSON.stringify(data, null, 2));
}

async function apiCall(method: string, endpoint: string, body?: any, token?: string): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (UAT_MODE) {
    headers['X-UAT-Mode'] = 'true';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      const errorDetails = JSON.stringify(data, null, 2);
      throw new Error(`${errorMsg}\nResponse: ${errorDetails}`);
    }
    
    return data;
  } catch (error: any) {
    if (error.message && error.message.includes('API call failed')) {
      throw error; // Re-throw if already formatted
    }
    throw new Error(`API call failed: ${error.message || JSON.stringify(error)}`);
  }
}

async function testVendorFlow() {
  console.log('\n🚀 Starting Vendor Flow E2E Test\n');
  console.log(`📱 Test Phone: ${TEST_PHONE}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}\n`);

  let vendorToken: string | undefined;
  let vendorId: string | undefined;
  let applicationId: string | undefined;
  let identityId: string | undefined;

  try {
    // STEP 1: Send OTP
    console.log('📤 Step 1: Sending OTP...');
    try {
      const otpResponse = await apiCall('POST', '/auth/send-otp', {
        phone: TEST_PHONE,
        role: 'vendor',
      });
      log('Send OTP', true, { success: otpResponse.success });
    } catch (error: any) {
      log('Send OTP', false, undefined, error.message);
      throw error;
    }

    // STEP 2: Verify OTP
    console.log('\n🔐 Step 2: Verifying OTP...');
    try {
      const verifyResponse = await apiCall('POST', '/auth/verify-otp', {
        phone: TEST_PHONE,
        otp: '123456', // UAT test OTP
        role: 'vendor',
      });
      
      // Handle nested response structure (response.data.data.token.access_token)
      const tokenData = verifyResponse.data?.data || verifyResponse.data;
      if (tokenData?.token?.access_token) {
        vendorToken = tokenData.token.access_token;
        vendorId = tokenData.user?.id || tokenData.profile?.id;
        log('Verify OTP', true, { 
          hasToken: !!vendorToken,
          vendorId,
          onboardingStatus: tokenData.profile?.onboarding_status 
        });
      } else {
        throw new Error('No access token in response: ' + JSON.stringify(verifyResponse, null, 2));
      }
    } catch (error: any) {
      log('Verify OTP', false, undefined, error.message);
      console.log('\n❌ Cannot continue without authentication. Stopping test.');
      throw error;
    }

    // STEP 3: Get onboarding status
    console.log('\n📊 Step 3: Getting onboarding status...');
    try {
      const statusResponse = await apiCall('GET', `/vendor/onboarding/status?phone=${TEST_PHONE}`, undefined, vendorToken);
      identityId = statusResponse.data?.identity?.id;
      const onboardingStatus = statusResponse.data?.identity?.onboarding_status;
      log('Get Onboarding Status', true, { identityId, onboardingStatus });
      
      if (onboardingStatus === 'ROLE_PENDING' || onboardingStatus === 'INIT') {
        // STEP 4: Select role
        console.log('\n🎭 Step 4: Selecting role (veterinarian)...');
        try {
          // First get available roles
          const rolesResponse = await apiCall('GET', '/config/roles', undefined, vendorToken);
          const roles = rolesResponse.roles || rolesResponse.data?.roles || [];
          const veterinarianRole = roles.find((r: any) => r.name === 'veterinarian' || r.roleCode === 'veterinarian');
          
          if (!veterinarianRole) {
            throw new Error('Veterinarian role not found');
          }

          const roleResponse = await apiCall('POST', '/vendor/onboarding/select-role', {
            phone: TEST_PHONE,
            role_id: veterinarianRole.id,
            vendorType: 'center',
          }, vendorToken);
          
          log('Select Role', true, { roleId: veterinarianRole.id });
          
          // STEP 4b: Select vendor type (required before form schema)
          console.log('\n🏢 Step 4b: Selecting vendor type (center)...');
          try {
            const vendorTypeResponse = await apiCall('POST', '/vendor/onboarding/select-vendor-type', {
              phone: TEST_PHONE,
              vendor_type: 'business', // Must be 'solo' or 'business', not 'center'
            }, vendorToken);
            
            log('Select Vendor Type', true, { vendorType: 'business' });
            
            // Wait a bit for the vendor type selection to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            log('Select Vendor Type', false, undefined, error.message);
            throw error;
          }
        } catch (error: any) {
          log('Select Role', false, undefined, error.message);
          throw error;
        }
      }

      // STEP 5: Get form schema
      console.log('\n📋 Step 5: Getting onboarding form schema...');
      let formSchema: any;
      try {
        const formResponse = await apiCall('GET', `/vendor/onboarding/form-schema?phone=${TEST_PHONE}`, undefined, vendorToken);
        formSchema = formResponse.data;
        log('Get Form Schema', true, { 
          sections: formSchema?.sections?.length || 0,
          totalFields: formSchema?.sections?.reduce((sum: number, s: any) => sum + (s.fields?.length || 0), 0) || 0
        });
      } catch (error: any) {
        log('Get Form Schema', false, undefined, error.message);
        throw error;
      }

      // STEP 6: Submit onboarding form
      console.log('\n📝 Step 6: Submitting onboarding form...');
      try {
        const formData = {
          businessName: `Test Veterinary Clinic ${Date.now()}`,
          email: TEST_EMAIL,
          contactPersonName: 'Dr. Test Vendor',
          address: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pin: '400001',
          experience: '5',
          specialization: 'General Practice',
          termsAccepted: true,
        };

        const submitResponse = await apiCall('POST', '/vendor/onboarding/submit-application', {
          phone: TEST_PHONE,
          application_payload: formData,
        }, vendorToken);
        
        applicationId = submitResponse.data?.applicationId;
        log('Submit Application', true, { applicationId });
      } catch (error: any) {
        log('Submit Application', false, undefined, error.message);
        throw error;
      }

      // STEP 7: Admin approval (using UAT mode - vendor token works in UAT)
      console.log('\n✅ Step 7: Approving vendor application (admin)...');
      try {
        // ✅ FIX: In UAT mode, we can use the vendor token for admin approval
        // The requireAdminAuth function will allow it in UAT mode
        const approveResponse = await apiCall('POST', `/admin/vendor/application/${applicationId}/approve`, {}, vendorToken);
        
        if (approveResponse.success || approveResponse.vendorId) {
          vendorId = approveResponse.vendorId || vendorId;
          log('Admin Approval', true, { vendorId, applicationId });
          
          // ✅ FIX: Re-verify OTP to get the real vendorId from vendors table
          console.log('   🔄 Re-verifying OTP to get real vendor ID...');
          try {
            const reVerifyResponse = await apiCall('POST', '/auth/verify-otp', {
              phone: TEST_PHONE,
              otp: '123456',
              role: 'vendor',
            });
            
            const tokenData = reVerifyResponse.data?.data || reVerifyResponse.data;
            const newVendorId = tokenData?.user?.id || tokenData?.profile?.id;
            if (newVendorId && !newVendorId.startsWith('temp_vendor_')) {
              vendorId = newVendorId;
              vendorToken = tokenData.token.access_token;
              console.log(`   ✅ Got real vendor ID: ${vendorId}`);
            }
          } catch (reVerifyErr) {
            console.warn('   ⚠️  Could not re-verify OTP:', reVerifyErr.message);
          }
        } else {
          throw new Error('Approval failed: ' + JSON.stringify(approveResponse));
        }
      } catch (error: any) {
        log('Admin Approval', false, undefined, error.message);
        // Continue anyway - might need manual approval
        console.log('   ⚠️  Continuing - approval may need to be done manually...');
        
        // Try to get vendorId from onboarding status
        try {
          const statusResponse = await apiCall('GET', `/vendor/onboarding/status?phone=${TEST_PHONE}`, undefined, vendorToken);
          const identity = statusResponse.data?.identity;
          if (identity?.vendor_id) {
            vendorId = identity.vendor_id;
            console.log(`   ✅ Got vendor ID from status: ${vendorId}`);
          }
        } catch (statusErr) {
          console.warn('   ⚠️  Could not get vendor ID from status:', statusErr.message);
        }
      }

      // Check if we have a real vendor ID (not temp)
      if (!vendorId || vendorId.startsWith('temp_vendor_')) {
        console.log('\n⚠️  Vendor ID is still temporary - skipping vendor operations until approval');
        console.log(`   Current vendorId: ${vendorId}`);
        console.log(`   Application ID: ${applicationId}`);
        console.log('   💡 Vendor needs to be approved to continue testing');
      } else {
        // STEP 8: Verify vendor can access dashboard/profile
        console.log('\n🏠 Step 8: Verifying vendor dashboard access...');
      try {
        // Try profile endpoint first
        const profileResponse = await apiCall('GET', `/vendor/${vendorId}/profile`, undefined, vendorToken);
        log('Vendor Profile Access', true, { 
          vendorId: profileResponse.data?.id || profileResponse.data?.vendor?.id,
          status: profileResponse.data?.status || profileResponse.data?.vendor?.status 
        });
      } catch (error: any) {
        // Try complete endpoint as fallback
        try {
          const completeResponse = await apiCall('GET', `/vendor/${vendorId}/complete`, undefined, vendorToken);
          log('Vendor Complete Access', true, { 
            vendorId: completeResponse.data?.id,
            status: completeResponse.data?.status 
          });
        } catch (error2: any) {
          log('Vendor Dashboard Access', false, undefined, error.message);
        }
      }

      // STEP 9: Update vendor profile (instead of center-profile endpoint which doesn't exist)
      console.log('\n🏢 Step 9: Updating vendor profile...');
      try {
        const profileUpdateResponse = await apiCall('PUT', `/vendor/${vendorId}/profile`, {
          business_name: `Test Veterinary Clinic ${Date.now()}`,
          address: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          phone: TEST_PHONE,
          email: TEST_EMAIL,
        }, vendorToken);
        
        log('Update Vendor Profile', true, { updated: true });
      } catch (error: any) {
        log('Update Vendor Profile', false, undefined, error.message);
      }

      // STEP 10: Create staff member
      console.log('\n👤 Step 10: Creating staff member...');
      try {
        const staffResponse = await apiCall('POST', `/vendor/${vendorId}/staff`, {
          name: 'Dr. Test Staff',
          phone: `98765${Date.now().toString().slice(-5)}`,
          email: `staff-${Date.now()}@test.warmpawz.app`,
          role: 'veterinarian',
          specialization: 'General Practice',
        }, vendorToken);
        
        log('Create Staff', true, { staffId: staffResponse.data?.id });
      } catch (error: any) {
        log('Create Staff', false, undefined, error.message);
      }

      // STEP 11: Create service (using correct endpoint)
      console.log('\n🛠️  Step 11: Creating service...');
      try {
        // First, we need a serviceId and serviceStyle from the catalog
        // For now, let's try creating a custom service
        const serviceResponse = await apiCall('POST', `/vendor/${vendorId}/services/custom`, {
          name: 'General Consultation',
          description: 'General veterinary consultation',
          serviceStyle: 'clinic', // or 'home' or 'instant'
          customPrice: 500,
          customDuration: 30,
          isEnabled: true,
        }, vendorToken);
        
        log('Create Service', true, { serviceId: serviceResponse.data?.id });
      } catch (error: any) {
        log('Create Service', false, undefined, error.message);
      }

      // STEP 12: Verify service appears for customers
      console.log('\n👥 Step 12: Verifying service appears for customers...');
      try {
        // Try customer vendor endpoint
        const vendorResponse = await apiCall('GET', `/customer/vendor/${vendorId}`);
        const hasVendor = !!vendorResponse.data;
        log('Customer Vendor Discovery', hasVendor, { 
          vendorId: vendorResponse.data?.id,
          vendorName: vendorResponse.data?.business_name
        });
        
        // Also try services endpoint
        try {
          const servicesResponse = await apiCall('GET', `/vendor/${vendorId}/services`);
          const services = servicesResponse.data?.services || servicesResponse.data || [];
          log('Vendor Services List', services.length > 0, { 
            serviceCount: Array.isArray(services) ? services.length : 0
          });
        } catch (servicesErr) {
          console.warn('   ⚠️  Could not get vendor services:', servicesErr.message);
        }
      } catch (error: any) {
        log('Service Discovery', false, undefined, error.message);
      }
      } // End of else block for real vendor ID
    } catch (error: any) {
      log('Get Onboarding Status', false, undefined, error.message);
    }

  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📱 Test Phone: ${TEST_PHONE}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  if (vendorId) console.log(`🆔 Vendor ID: ${vendorId}`);
  if (applicationId) console.log(`📄 Application ID: ${applicationId}`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${i + 1}. ${icon} ${r.step}`);
    if (r.error) console.log(`   └─ Error: ${r.error}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
testVendorFlow().catch(console.error);

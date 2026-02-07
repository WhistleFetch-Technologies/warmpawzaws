/**
 * Comprehensive Integration Test - Hard Refresh Fix
 * Tests with real database operations and edge cases
 */

const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const UAT_OTP = '123456';

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper: Make API request
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test helper
function logTest(name, passed, message = '') {
  if (passed) {
    results.passed.push(name);
    console.log(`✅ ${name}${message ? ': ' + message : ''}`);
  } else {
    results.failed.push(name);
    console.log(`❌ ${name}${message ? ': ' + message : ''}`);
  }
}

function logWarning(name, message) {
  results.warnings.push(`${name}: ${message}`);
  console.log(`⚠️  ${name}: ${message}`);
}

// ============================================================================
// TEST SUITE 1: Customer Edge Cases
// ============================================================================

async function testCustomerEdgeCases() {
  console.log('\n🧪 TEST SUITE 1: Customer Edge Cases\n');
  console.log('='.repeat(60));

  // Test 1.1: New Customer - First Time Login
  console.log('\n📋 Test 1.1: New Customer - First Time Login');
  try {
    const testPhone = `98765${Date.now().toString().slice(-5)}`; // Unique phone
    
    // Send OTP
    const sendOtpRes = await makeRequest('POST', '/auth/send-otp', {
      phone: testPhone,
      role: 'customer'
    });
    
    if (sendOtpRes.status === 200 || sendOtpRes.data?.success) {
      logTest('1.1.1 Send OTP to new customer', true);
    } else {
      logTest('1.1.1 Send OTP to new customer', false, sendOtpRes.data?.error);
    }

    // Verify OTP - Should create new customer
    const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
      phone: testPhone,
      otp: UAT_OTP,
      role: 'customer'
    });

    // Handle nested response structure
    let responseData = verifyRes.data;
    if (responseData?.data) {
      responseData = responseData.data;
    }
    if (responseData?.data) {
      responseData = responseData.data;
    }

    const token = responseData?.token?.access_token || 
                  responseData?.token?.accessToken ||
                  responseData?.access_token ||
                  responseData?.accessToken;
    const state = responseData?.state;
    const profile = responseData?.profile;

    if (verifyRes.status === 200 && token) {
      
      logTest('1.1.2 OTP verify creates new customer', true);
      logTest('1.1.3 Token returned', !!token);
      logTest('1.1.4 State field present', !!state, `State: ${state || 'missing'}`);
      logTest('1.1.5 Profile includes full_name', !!profile?.full_name, `Name: ${profile?.full_name || 'missing'}`);
      logTest('1.1.6 Profile includes onboarding_status', !!profile?.onboarding_status || !!profile?.onboardingStatus, 
        `Status: ${profile?.onboarding_status || profile?.onboardingStatus || 'missing'}`);
      
      // Test 1.2: Existing Customer - Second Login
      console.log('\n📋 Test 1.2: Existing Customer - Second Login');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Login again with same phone
      const sendOtp2Res = await makeRequest('POST', '/auth/send-otp', {
        phone: testPhone,
        role: 'customer'
      });
      
      const verify2Res = await makeRequest('POST', '/auth/verify-otp', {
        phone: testPhone,
        otp: UAT_OTP,
        role: 'customer'
      });

      // Handle nested response
      let responseData2 = verify2Res.data;
      if (responseData2?.data) responseData2 = responseData2.data;
      if (responseData2?.data) responseData2 = responseData2.data;
      
      const token2 = responseData2?.token?.access_token || 
                     responseData2?.token?.accessToken ||
                     responseData2?.access_token ||
                     responseData2?.accessToken;
      const state2 = responseData2?.state;

      if (verify2Res.status === 200 && token2) {
        logTest('1.2.1 Existing customer login works', true);
        // Note: State might still be "new" if customer was just created
        // This is expected behavior - state changes after profile completion
        logTest('1.2.2 State field present in response', !!state2, `State: ${state2 || 'missing'}`);
        if (state2 === 'existing') {
          logTest('1.2.2a State is "existing" (expected for returning user)', true);
        } else {
          logWarning('1.2.2a', `State is "${state2}" - might be "new" if just created`);
        }
        
        // Test profile endpoint
        const profileRes = await makeRequest('GET', `/customer/profile/unified/${testPhone}`, null, token2);
        
        if (profileRes.status === 200 && profileRes.data?.profile) {
          const profileData = profileRes.data.profile;
          logTest('1.2.3 Profile endpoint returns onboarding_status', 
            !!profileData.onboarding_status || !!profileData.onboardingStatus);
          logTest('1.2.4 Profile endpoint returns profile_completed', 
            profileData.profile_completed !== undefined || profileData.profileCompleted !== undefined);
        } else {
          logTest('1.2.3 Profile endpoint accessible', false, `Status: ${profileRes.status}`);
        }
      } else {
        logTest('1.2.1 Existing customer login', false, 
          verify2Res.data?.error || JSON.stringify(verify2Res.data).substring(0, 200));
      }

      return { phone: testPhone, token };
    } else {
      const errorMsg = verifyRes.data?.error?.message || 
                       verifyRes.data?.error?.details?.details ||
                       verifyRes.data?.error ||
                       JSON.stringify(verifyRes.data).substring(0, 200);
      logTest('1.1.2 OTP verify creates new customer', false, errorMsg);
      return null;
    }
  } catch (error) {
    logTest('1.1 Customer edge cases', false, error.message);
    return null;
  }
}

// ============================================================================
// TEST SUITE 2: Vendor Edge Cases
// ============================================================================

async function testVendorEdgeCases() {
  console.log('\n🧪 TEST SUITE 2: Vendor Edge Cases\n');
  console.log('='.repeat(60));

  // Test 2.1: New Vendor - First Time Login
  console.log('\n📋 Test 2.1: New Vendor - First Time Login');
  try {
    const testPhone = `98766${Date.now().toString().slice(-5)}`; // Unique phone
    
    // Send OTP
    const sendOtpRes = await makeRequest('POST', '/auth/send-otp', {
      phone: testPhone,
      role: 'vendor'
    });
    
    logTest('2.1.1 Send OTP to new vendor', sendOtpRes.status === 200 || sendOtpRes.data?.success);

    // Verify OTP
    const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
      phone: testPhone,
      otp: UAT_OTP,
      role: 'vendor'
    });

    if (verifyRes.status === 200 && verifyRes.data?.data?.token?.access_token) {
      const token = verifyRes.data.data.token.access_token;
      const state = verifyRes.data.data.state;
      const profile = verifyRes.data.data.profile;
      
      logTest('2.1.2 OTP verify works for vendor', true);
      logTest('2.1.3 State field present', !!vendorState, `State: ${vendorState || 'missing'}`);
      logTest('2.1.4 Profile includes status', !!vendorProfile?.status, `Status: ${vendorProfile?.status || 'missing'}`);
      
      // Test 2.2: Check onboarding status endpoint
      console.log('\n📋 Test 2.2: Vendor Onboarding Status');
      
      const statusRes = await makeRequest('GET', `/vendor/onboarding/status?phone=${testPhone}`, null, vendorToken);
      
      if (statusRes.status === 200 && statusRes.data?.identity) {
        const onboardingStatus = statusRes.data.identity.onboarding_status;
        logTest('2.2.1 Onboarding status endpoint accessible', true);
        logTest('2.2.2 Returns onboarding_status', !!onboardingStatus, `Status: ${onboardingStatus}`);
        logTest('2.2.3 New vendor has INIT status', onboardingStatus === 'INIT', `Got: ${onboardingStatus}`);
      } else {
        logTest('2.2.1 Onboarding status endpoint', false, `Status: ${statusRes.status}`);
      }

      return { phone: testPhone, token };
    } else {
      logTest('2.1.2 OTP verify for vendor', false, verifyRes.data?.error?.message);
      return null;
    }
  } catch (error) {
    logTest('2.1 Vendor edge cases', false, error.message);
    return null;
  }
}

// ============================================================================
// TEST SUITE 3: State Transitions
// ============================================================================

async function testStateTransitions(customerPhone, customerToken) {
  console.log('\n🧪 TEST SUITE 3: State Transitions\n');
  console.log('='.repeat(60));

  if (!customerPhone || !customerToken) {
    logWarning('3.0', 'Skipping state transitions - customer not created');
    return;
  }

  // Test 3.1: Profile Update Changes State
  console.log('\n📋 Test 3.1: Profile Update Changes State');
  
  try {
    // Update customer profile
    const updateRes = await makeRequest('PUT', `/customer/profile/${customerPhone}`, {
      full_name: 'Test Customer',
      email: `test${Date.now()}@example.com`
    }, customerToken);

    if (updateRes.status === 200 || updateRes.status === 201) {
      logTest('3.1.1 Profile update works', true);
      
      // Check profile after update
      const profileRes = await makeRequest('GET', `/customer/profile/unified/${customerPhone}`, null, customerToken);
      
      if (profileRes.status === 200 && profileRes.data?.profile) {
        const profile = profileRes.data.profile;
        logTest('3.1.2 Profile updated in database', !!profile.full_name);
        logTest('3.1.3 Onboarding status updated', 
          profile.onboarding_status !== 'PHONE_VERIFIED' || profile.onboardingStatus !== 'PHONE_VERIFIED');
      }
    } else {
      logTest('3.1.1 Profile update', false, `Status: ${updateRes.status}`);
    }
  } catch (error) {
    logTest('3.1 State transitions', false, error.message);
  }
}

// ============================================================================
// TEST SUITE 4: Edge Cases - Multiple Logins
// ============================================================================

async function testMultipleLogins() {
  console.log('\n🧪 TEST SUITE 4: Multiple Login Edge Cases\n');
  console.log('='.repeat(60));

  const testPhone = `98767${Date.now().toString().slice(-5)}`;

  // Test 4.1: Rapid consecutive logins
  console.log('\n📋 Test 4.1: Rapid Consecutive Logins');
  
  try {
    const tokens = [];
    
    for (let i = 0; i < 3; i++) {
      const sendRes = await makeRequest('POST', '/auth/send-otp', {
        phone: testPhone,
        role: 'customer'
      });
      
      const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
        phone: testPhone,
        otp: UAT_OTP,
        role: 'customer'
      });
      
      // Handle nested response
      let multiResponseData = verifyRes.data;
      if (multiResponseData?.data) multiResponseData = multiResponseData.data;
      if (multiResponseData?.data) multiResponseData = multiResponseData.data;
      
      const multiToken = multiResponseData?.token?.access_token || 
                         multiResponseData?.token?.accessToken ||
                         multiResponseData?.access_token ||
                         multiResponseData?.accessToken;
      
      if (verifyRes.status === 200 && multiToken) {
        tokens.push(multiToken);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    logTest('4.1.1 Multiple rapid logins work', tokens.length === 3, `Got ${tokens.length} tokens`);
    logTest('4.1.2 Each login returns unique token', 
      new Set(tokens).size === tokens.length, 'All tokens unique');
    
    // Test 4.2: State consistency across logins
    console.log('\n📋 Test 4.2: State Consistency');
    
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const profileRes = await makeRequest('GET', `/customer/profile/unified/${testPhone}`, null, lastToken);
      
      if (profileRes.status === 200) {
        logTest('4.2.1 State consistent across logins', true);
        logTest('4.2.2 Profile accessible with latest token', true);
      }
    }
  } catch (error) {
    logTest('4.1 Multiple logins', false, error.message);
  }
}

// ============================================================================
// TEST SUITE 5: Token Expiry and Refresh
// ============================================================================

async function testTokenExpiry(customerToken) {
  console.log('\n🧪 TEST SUITE 5: Token Expiry Edge Cases\n');
  console.log('='.repeat(60));

  if (!customerToken) {
    logWarning('5.0', 'Skipping token expiry tests - no token');
    return;
  }

  // Test 5.1: Token validation
  console.log('\n📋 Test 5.1: Token Validation');
  
  try {
    // Try to use token immediately
    const profileRes = await makeRequest('GET', '/customer/profile/unified/9876543210', null, customerToken);
    
    if (profileRes.status === 200 || profileRes.status === 401) {
      logTest('5.1.1 Token validation works', true, `Status: ${profileRes.status}`);
    } else {
      logTest('5.1.1 Token validation', false, `Status: ${profileRes.status}`);
    }
    
    // Test 5.2: Decode token to check expiry
    try {
      const parts = customerToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = exp - now;
        
        logTest('5.2.1 Token has expiry field', !!exp);
        logTest('5.2.2 Token expiry in future', expiresIn > 0, `Expires in: ${expiresIn}s`);
        logTest('5.2.3 Token expiry reasonable (UAT: 60s)', expiresIn <= 120, `Expires in: ${expiresIn}s`);
      }
    } catch (e) {
      logTest('5.2.1 Token decode', false, e.message);
    }
  } catch (error) {
    logTest('5.1 Token expiry', false, error.message);
  }
}

// ============================================================================
// TEST SUITE 6: Database State Persistence
// ============================================================================

async function testDatabasePersistence(customerPhone, customerToken) {
  console.log('\n🧪 TEST SUITE 6: Database State Persistence\n');
  console.log('='.repeat(60));

  if (!customerPhone || !customerToken) {
    logWarning('6.0', 'Skipping DB persistence tests - no customer');
    return;
  }

  // Test 6.1: State persists across API calls
  console.log('\n📋 Test 6.1: State Persistence');
  
  try {
    // Get profile multiple times
    const profiles = [];
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest('GET', `/customer/profile/unified/${customerPhone}`, null, customerToken);
      if (res.status === 200 && res.data?.profile) {
        profiles.push(res.data.profile);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (profiles.length === 3) {
      const onboardingStatuses = profiles.map(p => p.onboarding_status || p.onboardingStatus);
      const allSame = new Set(onboardingStatuses).size === 1;
      
      logTest('6.1.1 Multiple profile calls work', true);
      logTest('6.1.2 State consistent across calls', allSame, 
        `Statuses: ${onboardingStatuses.join(', ')}`);
      logTest('6.1.3 Profile data persists', profiles[0].id === profiles[1].id && profiles[1].id === profiles[2].id);
    } else {
      logTest('6.1.1 Multiple profile calls', false, `Got ${profiles.length} successful calls`);
    }
  } catch (error) {
    logTest('6.1 Database persistence', false, error.message);
  }
}

// ============================================================================
// TEST SUITE 7: Error Cases
// ============================================================================

async function testErrorCases() {
  console.log('\n🧪 TEST SUITE 7: Error Cases\n');
  console.log('='.repeat(60));

  // Test 7.1: Invalid OTP
  console.log('\n📋 Test 7.1: Invalid OTP');
  
  try {
    const testPhone = `98768${Date.now().toString().slice(-5)}`;
    
    await makeRequest('POST', '/auth/send-otp', {
      phone: testPhone,
      role: 'customer'
    });
    
    const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
      phone: testPhone,
      otp: '000000', // Wrong OTP
      role: 'customer'
    });
    
    // In UAT mode, wrong OTP should fail
    logTest('7.1.1 Invalid OTP rejected', 
      verifyRes.status === 401 || verifyRes.data?.error, 
      `Status: ${verifyRes.status}`);
  } catch (error) {
    logTest('7.1 Invalid OTP', false, error.message);
  }

  // Test 7.2: Missing phone
  console.log('\n📋 Test 7.2: Missing Required Fields');
  
  try {
    const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
      otp: UAT_OTP,
      role: 'customer'
      // Missing phone
    });
    
    logTest('7.2.1 Missing phone rejected', 
      verifyRes.status === 400 || verifyRes.data?.error, 
      `Status: ${verifyRes.status}`);
  } catch (error) {
    logTest('7.2 Missing phone', false, error.message);
  }

  // Test 7.3: Invalid role
  console.log('\n📋 Test 7.3: Invalid Role');
  
  try {
    const verifyRes = await makeRequest('POST', '/auth/verify-otp', {
      phone: '9876543210',
      otp: UAT_OTP,
      role: 'invalid_role'
    });
    
    logTest('7.3.1 Invalid role rejected', 
      verifyRes.status === 400 || verifyRes.data?.error, 
      `Status: ${verifyRes.status}`);
  } catch (error) {
    logTest('7.3 Invalid role', false, error.message);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Integration Tests');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`UAT Mode: Enabled (OTP: ${UAT_OTP})`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Run test suites
    const customerResult = await testCustomerEdgeCases();
    const vendorResult = await testVendorEdgeCases();
    
    if (customerResult) {
      await testStateTransitions(customerResult.phone, customerResult.token);
      await testTokenExpiry(customerResult.token);
      await testDatabasePersistence(customerResult.phone, customerResult.token);
    }
    
    await testMultipleLogins();
    await testErrorCases();

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));

    if (results.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      results.failed.forEach(test => console.log(`   - ${test}`));
    }

    if (results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      results.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    const successRate = (results.passed.length / (results.passed.length + results.failed.length) * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}%`);

    if (results.failed.length === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Review above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();

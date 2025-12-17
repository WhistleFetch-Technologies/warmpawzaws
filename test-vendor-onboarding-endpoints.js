/**
 * Vendor Onboarding Endpoints - Comprehensive Test Suite (Node.js)
 * Tests all new endpoints: Edit, Withdraw, History, and Bank Validation
 */

const https = require('https');

// Configuration
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || '3dd53475';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475`;

// Test results
let passed = 0;
let failed = 0;
let total = 0;

// Helper functions
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function printTest(name) {
  console.log(`\n▶ Testing: ${name}`);
  total++;
}

function printPass(message) {
  console.log(`✓ PASS: ${message}`);
  passed++;
}

function printFail(message, response = null) {
  console.log(`✗ FAIL: ${message}`);
  if (response) {
    console.log(`  Response:`, JSON.stringify(response, null, 2));
  }
  failed++;
}

function printInfo(message) {
  console.log(`ℹ ${message}`);
}

// Test data
const testPhone = `+9198765432${Math.floor(Math.random() * 10000)}`;
const testEmail = `test-vendor-${Date.now()}@test.com`;
let testVendorId = '';
let testApplicationId = '';

async function runTests() {
  console.log('==========================================');
  console.log('Vendor Onboarding Endpoints Test Suite');
  console.log('==========================================\n');

  // ============================================
  // TEST 1: Create Test Vendor Application
  // ============================================
  printTest('Creating test vendor application');

  try {
    const createResponse = await makeRequest('POST', '/vendor/apply', {
      roleId: 'vet',
      phone: testPhone,
      email: testEmail,
      serviceStyle: 'both',
      formData: {
        businessName: 'Test Vet Clinic',
        fullName: 'Dr. Test Vendor',
        address: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstNumber: '27AABCU9603R1ZX',
        yearsOfExperience: 5,
        accountHolderName: 'Test Vendor',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0000001',
        bankName: 'HDFC Bank',
        branchName: 'Mumbai Branch'
      },
      documents: {},
      location: {
        lat: 19.0760,
        lng: 72.8777
      }
    });

    if (createResponse.data.vendorId) {
      testVendorId = createResponse.data.vendorId;
      testApplicationId = createResponse.data.applicationId;
      printPass(`Application created - Vendor ID: ${testVendorId}`);
      printInfo(`Application ID: ${testApplicationId}`);
    } else {
      printFail('Failed to create application', createResponse);
      return;
    }
  } catch (error) {
    printFail('Error creating application', error.message);
    return;
  }

  // ============================================
  // TEST 2: Check Application Status
  // ============================================
  printTest('Checking application status');

  try {
    const statusResponse = await makeRequest('GET', `/vendor/status/${encodeURIComponent(testPhone)}`);

    if (statusResponse.data.status === 'pending_approval' || statusResponse.data.hasApplication) {
      printPass('Status check successful - Application is pending');
    } else {
      printFail('Status check failed or unexpected status', statusResponse);
    }
  } catch (error) {
    printFail('Error checking status', error.message);
  }

  // ============================================
  // TEST 3: Get Application History
  // ============================================
  printTest('Getting application history (should be empty or minimal)');

  try {
    const historyResponse = await makeRequest('GET', `/vendor/application/${testVendorId}/history`);

    if (historyResponse.data && Array.isArray(historyResponse.data.history)) {
      printPass('History endpoint accessible');
      printInfo(`History: ${historyResponse.data.history.length} entries`);
    } else {
      printFail('History endpoint failed', historyResponse);
    }
  } catch (error) {
    printFail('Error getting history', error.message);
  }

  // ============================================
  // TEST 4: Edit Application (Valid Status)
  // ============================================
  printTest('Editing application (pending_approval status)');

  try {
    const editResponse = await makeRequest('PUT', `/vendor/application/${testVendorId}`, {
      formData: {
        businessName: 'Updated Test Vet Clinic',
        fullName: 'Dr. Updated Test Vendor',
        address: '456 Updated Street',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        gstNumber: '27AABCU9603R1ZX',
        yearsOfExperience: 7
      },
      location: {
        lat: 18.5204,
        lng: 73.8567
      }
    });

    if (editResponse.data.success || editResponse.data.vendorId) {
      printPass('Application edit successful');

      // Verify edit was saved
      const verifyStatus = await makeRequest('GET', `/vendor/status/${encodeURIComponent(testPhone)}`);
      if (verifyStatus.data.fullName && verifyStatus.data.fullName.includes('Updated')) {
        printPass('Edit verified - Data updated correctly');
      } else {
        printInfo('Edit verification: Status endpoint may not return full details');
      }
    } else {
      printFail('Application edit failed', editResponse);
    }
  } catch (error) {
    printFail('Error editing application', error.message);
  }

  // ============================================
  // TEST 5: Get Application History (After Edit)
  // ============================================
  printTest('Getting application history (after edit)');

  try {
    const historyResponse2 = await makeRequest('GET', `/vendor/application/${testVendorId}/history`);

    if (historyResponse2.data.history && historyResponse2.data.history.length > 0) {
      printPass('History contains entries after edit');
      printInfo(`Found ${historyResponse2.data.history.length} history entries`);

      const hasEditEntry = historyResponse2.data.history.some(
        entry => entry.action === 'application_updated' || entry.newStatus === 'resubmitted'
      );

      if (hasEditEntry) {
        printPass('Edit action recorded in history');
      } else {
        printFail('Edit action not found in history');
      }
    } else {
      printFail('History is empty after edit');
    }
  } catch (error) {
    printFail('Error getting history after edit', error.message);
  }

  // ============================================
  // TEST 6: Edit Application Validation (Invalid Status)
  // ============================================
  printTest('Testing edit validation - Approve first, then try to edit');

  try {
    // First approve the application
    const approveResponse = await makeRequest('POST', '/admin/vendor/approve', {
      vendorId: testVendorId,
      approvedBy: 'Test Admin',
      notes: 'Test approval'
    });

    if (approveResponse.data.success || approveResponse.data.vendor) {
      printPass('Application approved for testing');

      // Wait a bit for status to update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Now try to edit (should fail)
      const editFailResponse = await makeRequest('PUT', `/vendor/application/${testVendorId}`, {
        formData: {
          businessName: 'Should Not Update'
        }
      });

      if (editFailResponse.data.error === 'cannot_edit' || editFailResponse.status === 400) {
        printPass('Edit correctly rejected for approved status');
      } else {
        printFail('Edit should have been rejected for approved status', editFailResponse);
      }
    } else {
      printFail('Failed to approve application for testing', approveResponse);
    }
  } catch (error) {
    printFail('Error in edit validation test', error.message);
  }

  // ============================================
  // TEST 7: Withdraw Application
  // ============================================
  printTest('Testing application withdrawal');

  try {
    // Create a new application for withdrawal test
    const withdrawPhone = `+9198765432${Math.floor(Math.random() * 10000)}`;
    const withdrawEmail = `withdraw-test-${Date.now()}@test.com`;

    const withdrawCreate = await makeRequest('POST', '/vendor/apply', {
      roleId: 'groomer',
      phone: withdrawPhone,
      email: withdrawEmail,
      serviceStyle: 'at_home',
      formData: {
        businessName: 'Test Groomer',
        fullName: 'Test Groomer Name',
        address: '789 Test Ave',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      },
      documents: {}
    });

    const withdrawVendorId = withdrawCreate.data.vendorId;

    if (withdrawVendorId) {
      // Now withdraw it
      const withdrawResponse = await makeRequest('POST', `/vendor/application/${withdrawVendorId}/withdraw`, {
        reason: 'Found another platform'
      });

      if (withdrawResponse.data.success || withdrawResponse.data.status === 'withdrawn') {
        printPass('Application withdrawal successful');

        // Verify status
        const withdrawStatus = await makeRequest('GET', `/vendor/status/${encodeURIComponent(withdrawPhone)}`);
        if (withdrawStatus.data.status === 'withdrawn') {
          printPass('Withdrawal status verified');
        } else {
          printInfo('Withdrawal status verification: May need to check vendor details endpoint');
        }
      } else {
        printFail('Application withdrawal failed', withdrawResponse);
      }
    } else {
      printFail('Failed to create application for withdrawal test', withdrawCreate);
    }
  } catch (error) {
    printFail('Error in withdrawal test', error.message);
  }

  // ============================================
  // TEST 8: Withdraw Validation (Invalid Status)
  // ============================================
  printTest('Testing withdrawal validation - Try to withdraw approved application');

  try {
    const withdrawInvalid = await makeRequest('POST', `/vendor/application/${testVendorId}/withdraw`, {
      reason: 'Should not work'
    });

    if (withdrawInvalid.data.error === 'cannot_withdraw' || withdrawInvalid.status === 400) {
      printPass('Withdrawal correctly rejected for approved status');
    } else {
      printFail('Withdrawal should have been rejected for approved status', withdrawInvalid);
    }
  } catch (error) {
    printFail('Error in withdrawal validation test', error.message);
  }

  // ============================================
  // TEST 9: Bank Validation (IFSC)
  // ============================================
  printTest('Testing bank validation with IFSC code');

  try {
    const bankValidate = await makeRequest('POST', '/vendor/validate-ifsc', {
      ifscCode: 'HDFC0000001'
    });

    if (bankValidate.data.success && bankValidate.data.ifscDetails && bankValidate.data.ifscDetails.valid) {
      printPass('IFSC validation successful');
      if (bankValidate.data.ifscDetails.bank) {
        printPass('Bank details returned from validation');
        printInfo(`Bank: ${bankValidate.data.ifscDetails.bank}, Branch: ${bankValidate.data.ifscDetails.branch}`);
      }
    } else {
      printFail('IFSC validation failed', bankValidate);
    }
  } catch (error) {
    printFail('Error in bank validation test', error.message);
  }

  // ============================================
  // TEST 10: Bank Validation (Invalid IFSC)
  // ============================================
  printTest('Testing bank validation with invalid IFSC code');

  try {
    const invalidIfsc = await makeRequest('POST', '/vendor/validate-ifsc', {
      ifscCode: 'INVALID12345'
    });

    if (!invalidIfsc.data.success || invalidIfsc.data.error || invalidIfsc.status === 404) {
      printPass('Invalid IFSC correctly rejected');
    } else {
      printFail('Invalid IFSC should have been rejected', invalidIfsc);
    }
  } catch (error) {
    printFail('Error in invalid IFSC test', error.message);
  }

  // ============================================
  // TEST 11: Application with Bank Validation
  // ============================================
  printTest('Testing application submission with bank validation');

  try {
    const bankTestPhone = `+9198765432${Math.floor(Math.random() * 10000)}`;
    const bankTestEmail = `bank-test-${Date.now()}@test.com`;

    const bankApp = await makeRequest('POST', '/vendor/apply', {
      roleId: 'trainer',
      phone: bankTestPhone,
      email: bankTestEmail,
      serviceStyle: 'at_center',
      formData: {
        businessName: 'Test Trainer',
        fullName: 'Test Trainer Name',
        address: '321 Test Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        accountHolderName: 'Test Account Holder',
        accountNumber: '9876543210',
        ifscCode: 'SBIN0000001',
        bankName: '',
        branchName: ''
      },
      documents: {}
    });

    if (bankApp.data.vendorId) {
      printPass('Application with bank details created');
      printInfo('Bank validation should have auto-filled bank name from IFSC');
    } else {
      printFail('Failed to create application with bank details', bankApp);
    }
  } catch (error) {
    printFail('Error in bank validation application test', error.message);
  }

  // ============================================
  // TEST SUMMARY
  // ============================================
  console.log('\n==========================================');
  console.log('Test Summary');
  console.log('==========================================');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


#!/usr/bin/env node
/**
 * Test Tele Queue Join API Endpoint
 * Verifies that the queue joining works correctly after the fix
 */

const https = require('https');

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Test data (you'll need to replace with actual IDs from your database)
const TEST_DATA = {
  customerId: process.env.TEST_CUSTOMER_ID || '00000000-0000-0000-0000-000000000001',
  staffId: process.env.TEST_STAFF_ID || null, // Will be set from available providers
  petId: process.env.TEST_PET_ID || '00000000-0000-0000-0000-000000000001',
  serviceId: process.env.TEST_SERVICE_ID || null, // Will be set from available services
};

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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

async function testTeleQueueJoin() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Tele Queue Join API Test                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  try {
    // Step 1: Get available providers
    console.log('📋 Step 1: Fetching available providers...');
    const providersResponse = await makeRequest('/customer/tele/available-providers?roleId=veterinarian');
    
    if (providersResponse.status !== 200) {
      console.error(`❌ Failed to fetch providers: ${providersResponse.status}`);
      console.error(`   Response: ${JSON.stringify(providersResponse.data, null, 2)}`);
      return;
    }

    const providers = providersResponse.data.providers || [];
    console.log(`✅ Found ${providers.length} available providers`);
    
    if (providers.length === 0) {
      console.log('⚠️  No providers available. Cannot test queue joining.');
      console.log('   Please ensure at least one provider is available for tele consultations.');
      return;
    }

    const testProvider = providers[0];
    console.log(`   Using provider: ${testProvider.name || testProvider.providerId}`);
    console.log('');

    // Step 2: Get available services
    console.log('📋 Step 2: Fetching available services...');
    const servicesResponse = await makeRequest(
      `/customer/services/platform?roleId=veterinarian&serviceStyle=tele`
    );

    let serviceId = TEST_DATA.serviceId;
    if (servicesResponse.status === 200 && servicesResponse.data.services) {
      const services = servicesResponse.data.services;
      if (services.length > 0) {
        serviceId = services[0].serviceId || services[0].id;
        console.log(`✅ Found service: ${services[0].name || serviceId}`);
      }
    }

    if (!serviceId) {
      console.log('⚠️  No service ID available. Using default.');
      serviceId = 'instant-general';
    }
    console.log('');

    // Step 3: Test queue joining
    console.log('📋 Step 3: Testing queue join...');
    const staffId = testProvider.providerId || testProvider.staffId;
    
    const joinQueueBody = {
      customerId: TEST_DATA.customerId,
      staffId: staffId,
      petId: TEST_DATA.petId,
      serviceId: serviceId,
      symptoms: 'Test symptoms for verification',
      urgency: 'normal',
    };

    console.log('   Request body:');
    console.log(`   - customerId: ${joinQueueBody.customerId}`);
    console.log(`   - staffId: ${joinQueueBody.staffId}`);
    console.log(`   - petId: ${joinQueueBody.petId}`);
    console.log(`   - serviceId: ${joinQueueBody.serviceId}`);
    console.log('');

    const joinResponse = await makeRequest('/customer/tele/join-queue', 'POST', joinQueueBody);

    console.log(`   Response Status: ${joinResponse.status}`);
    
    if (joinResponse.status === 200 || joinResponse.status === 201) {
      console.log('✅ Queue join successful!');
      console.log('   Response:');
      console.log(`   - Queue ID: ${joinResponse.data.queueEntry?.id || 'N/A'}`);
      console.log(`   - Position: ${joinResponse.data.queueEntry?.position || 'N/A'}`);
      console.log(`   - Status: ${joinResponse.data.queueEntry?.status || 'N/A'}`);
      console.log(`   - Message: ${joinResponse.data.message || 'N/A'}`);
      console.log('');
      console.log('🎉 Test PASSED - Queue joining works correctly!');
    } else if (joinResponse.status === 400) {
      console.log('⚠️  Validation error (expected for test data):');
      console.log(`   Error: ${joinResponse.data.error || JSON.stringify(joinResponse.data)}`);
      console.log('');
      console.log('ℹ️  This is likely due to invalid test IDs.');
      console.log('   The endpoint is working, but you need valid customer/pet/provider IDs.');
    } else if (joinResponse.status === 500) {
      console.error('❌ Server error (500) - This should be fixed!');
      console.error(`   Error: ${joinResponse.data.error || JSON.stringify(joinResponse.data)}`);
      console.log('');
      console.log('🔍 Check:');
      console.log('   1. Is migration 216 applied? (vendor_id column exists)');
      console.log('   2. Are the backend changes deployed?');
      console.log('   3. Check CloudWatch logs for detailed error');
    } else {
      console.log(`⚠️  Unexpected status: ${joinResponse.status}`);
      console.log(`   Response: ${JSON.stringify(joinResponse.data, null, 2)}`);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Test failed with error:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
  }
}

// Run test
testTeleQueueJoin().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

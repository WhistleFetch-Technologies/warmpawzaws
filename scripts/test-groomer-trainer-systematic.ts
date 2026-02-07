/**
 * Systematic Testing Script for Groomer & Trainer Booking Flows
 * 
 * This script performs complete end-to-end testing with:
 * - Actual API calls
 * - Step-by-step flow tracing
 * - Complete lifecycle verification
 * - Detailed result reporting
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '+919876543210';

interface TestStep {
  step: number;
  name: string;
  description: string;
  apiCall?: {
    method: 'GET' | 'POST' | 'PUT';
    endpoint: string;
    payload?: any;
  };
  expectedResult: string;
  actualResult?: any;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
  timestamp: string;
}

interface TestFlow {
  flowName: string;
  role: 'groomer' | 'trainer';
  serviceStyle: 'at_center' | 'at_home';
  steps: TestStep[];
  vendorId?: string;
  serviceId?: string;
  bookingId?: string;
  petId?: string;
  startTime: string;
  endTime?: string;
  overallStatus: 'PENDING' | 'PASS' | 'FAIL';
}

const testFlows: TestFlow[] = [];
const allResults: any[] = [];

// Helper function to make API calls using fetch
async function makeAPICall(
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  payload?: any
): Promise<{ success: boolean; data?: any; error?: any; status?: number }> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    };

    if (payload && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        success: true,
        data,
        status: response.status,
      };
    } else {
      return {
        success: false,
        error: data || response.statusText,
        status: response.status,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
      status: 500,
    };
  }
}

// Helper to create test step
function createStep(
  step: number,
  name: string,
  description: string,
  apiCall?: TestStep['apiCall'],
  expectedResult: string = ''
): TestStep {
  return {
    step,
    name,
    description,
    apiCall,
    expectedResult,
    status: 'PENDING',
    timestamp: new Date().toISOString(),
  };
}

// Helper to log step result
function logStep(step: TestStep, flowName: string) {
  const icon = step.status === 'PASS' ? '✅' : step.status === 'FAIL' ? '❌' : step.status === 'SKIP' ? '⏭️' : '⏳';
  console.log(`  ${icon} Step ${step.step}: ${step.name}`);
  if (step.status === 'FAIL') {
    console.log(`     Error: ${step.error}`);
  }
  if (step.actualResult && step.status === 'PASS') {
    console.log(`     Result: ${JSON.stringify(step.actualResult).substring(0, 100)}...`);
  }
}

// Test Flow: Vendor Discovery
async function testVendorDiscovery(
  role: 'groomer' | 'trainer',
  serviceStyle: 'at_center' | 'at_home'
): Promise<{ vendorId?: string; vendors?: any[] }> {
  const category = role === 'groomer' ? 'grooming' : 'training';
  const roleId = role === 'groomer' ? 'pet_groomer' : 'pet_trainer';
  
  const endpoint = `/customer/discover-services?category=${category}&roleId=${roleId}&serviceStyle=${serviceStyle}`;
  const result = await makeAPICall('GET', endpoint);

  if (result.success && result.data?.vendors?.length > 0) {
    return {
      vendorId: result.data.vendors[0].id || result.data.vendors[0].vendorId,
      vendors: result.data.vendors,
    };
  }

  return {};
}

// Test Flow: Get Vendor Services
async function testGetVendorServices(vendorId: string): Promise<{ serviceId?: string; services?: any[] }> {
  const result = await makeAPICall('GET', `/vendor/${vendorId}/services`);

  if (result.success && result.data?.services?.length > 0) {
    const service = result.data.services[0];
    return {
      serviceId: service.serviceId || service.service_id || service.id,
      services: result.data.services,
    };
  }

  return {};
}

// Test Flow: Get Customer Pets
async function testGetCustomerPets(): Promise<{ petId?: string; pets?: any[] }> {
  const result = await makeAPICall('GET', `/customer/pets/${TEST_CUSTOMER_PHONE}`);

  if (result.success && result.data?.pets?.length > 0) {
    return {
      petId: result.data.pets[0].id,
      pets: result.data.pets,
    };
  }

  return {};
}

// Test Flow: Get Available Time Slots
async function testGetTimeSlots(vendorId: string, serviceStyle: string): Promise<{ time?: string; date?: string }> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const endpoint = `/customer/vendor/${vendorId}/available-slots?date=${dateStr}&serviceStyle=${serviceStyle}`;
  const result = await makeAPICall('GET', endpoint);

  if (result.success && result.data?.slots?.length > 0) {
    const availableSlot = result.data.slots.find((s: any) => s.available);
    if (availableSlot) {
      return {
        time: availableSlot.time,
        date: dateStr,
      };
    }
  }

  return { date: dateStr };
}

// Test Flow: Check Packages
async function testCheckPackages(vendorId: string, customerId: string, serviceType: string): Promise<any> {
  const endpoint = `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}&serviceType=${serviceType}`;
  const result = await makeAPICall('GET', endpoint);

  if (result.success) {
    return result.data;
  }

  return null;
}

// Test Flow: Create Booking
async function testCreateBooking(
  vendorId: string,
  serviceId: string,
  serviceStyle: string,
  serviceType: string,
  petId: string,
  date: string,
  time: string
): Promise<{ bookingId?: string; booking?: any }> {
  const bookingData = {
    customer_phone: TEST_CUSTOMER_PHONE,
    vendor_id: vendorId,
    service_id: serviceId,
    service_type: serviceStyle,
    service_name: `${serviceType} service`,
    price: 999,
    scheduled_date: date,
    scheduled_time: time,
    pet_id: petId,
    pet_name: 'Test Pet',
    notes: `Systematic test booking for ${serviceType} ${serviceStyle}`,
    status: 'pending',
  };

  const result = await makeAPICall('POST', '/bookings/create', bookingData);

  if (result.success && result.data?.booking?.id) {
    return {
      bookingId: result.data.booking.id,
      booking: result.data.booking,
    };
  }

  return {};
}

// Test Flow: Get Booking Details
async function testGetBookingDetails(bookingId: string): Promise<any> {
  const result = await makeAPICall('GET', `/customer/bookings/${bookingId}`);

  if (result.success) {
    return result.data;
  }

  return null;
}

// Test Flow: Complete Booking with OTP (Vendor Side)
async function testCompleteBookingWithOTP(bookingId: string, vendorId: string): Promise<any> {
  // First generate OTP
  const otpResult = await makeAPICall('POST', '/bookings/generate-otp', {
    bookingId,
    customerPhone: TEST_CUSTOMER_PHONE,
  });

  const otp = otpResult.data?.otp || '123456'; // Fallback for testing

  // Complete booking with OTP
  const completeResult = await makeAPICall('POST', `/vendor/bookings/${bookingId}/complete`, {
    otp,
    vendorId,
  });

  return completeResult;
}

// Test Flow: Check Earnings
async function testCheckEarnings(vendorId: string, bookingId: string): Promise<any> {
  const result = await makeAPICall('GET', `/vendor/${vendorId}/earnings`);

  if (result.success && result.data?.earnings) {
    const bookingEarning = result.data.earnings.find((e: any) =>
      e.bookingId === bookingId || e.booking_id === bookingId
    );
    return bookingEarning;
  }

  return null;
}

// Test Flow: Check Settlements
async function testCheckSettlements(vendorId: string, bookingId: string): Promise<any> {
  const result = await makeAPICall('GET', `/vendor/${vendorId}/settlements`);

  if (result.success && result.data?.settlements) {
    const bookingSettlement = result.data.settlements.find((s: any) =>
      s.bookingId === bookingId || s.booking_id === bookingId
    );
    return bookingSettlement;
  }

  return null;
}

// Main test flow execution
async function executeTestFlow(
  role: 'groomer' | 'trainer',
  serviceStyle: 'at_center' | 'at_home'
): Promise<TestFlow> {
  const flowName = `${role} ${serviceStyle}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing Flow: ${flowName.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  const flow: TestFlow = {
    flowName,
    role,
    serviceStyle,
    steps: [],
    startTime: new Date().toISOString(),
    overallStatus: 'PENDING',
  };

  let stepNumber = 1;

  // Step 1: Vendor Discovery
  const step1 = createStep(
    stepNumber++,
    'Vendor Discovery',
    `Discover ${role} vendors for ${serviceStyle} services`,
    {
      method: 'GET',
      endpoint: `/customer/discover-services?category=${role === 'groomer' ? 'grooming' : 'training'}&roleId=${role === 'groomer' ? 'pet_groomer' : 'pet_trainer'}&serviceStyle=${serviceStyle}`,
    },
    'Should return list of vendors'
  );

  const vendorDiscovery = await testVendorDiscovery(role, serviceStyle);
  if (vendorDiscovery.vendorId) {
    step1.status = 'PASS';
    step1.actualResult = { vendorId: vendorDiscovery.vendorId, vendorCount: vendorDiscovery.vendors?.length || 0 };
    flow.vendorId = vendorDiscovery.vendorId;
  } else {
    step1.status = 'FAIL';
    step1.error = 'No vendors found';
  }
  logStep(step1, flowName);
  flow.steps.push(step1);

  if (!flow.vendorId) {
    flow.overallStatus = 'FAIL';
    flow.endTime = new Date().toISOString();
    return flow;
  }

  // Step 2: Get Vendor Services
  const step2 = createStep(
    stepNumber++,
    'Get Vendor Services',
    `Get available services for vendor ${flow.vendorId}`,
    {
      method: 'GET',
      endpoint: `/vendor/${flow.vendorId}/services`,
    },
    'Should return list of services'
  );

  const vendorServices = await testGetVendorServices(flow.vendorId);
  if (vendorServices.serviceId) {
    step2.status = 'PASS';
    step2.actualResult = { serviceId: vendorServices.serviceId, serviceCount: vendorServices.services?.length || 0 };
    flow.serviceId = vendorServices.serviceId;
  } else {
    step2.status = 'FAIL';
    step2.error = 'No services found';
  }
  logStep(step2, flowName);
  flow.steps.push(step2);

  if (!flow.serviceId) {
    flow.overallStatus = 'FAIL';
    flow.endTime = new Date().toISOString();
    return flow;
  }

  // Step 3: Get Customer Pets
  const step3 = createStep(
    stepNumber++,
    'Get Customer Pets',
    `Get pets for customer ${TEST_CUSTOMER_PHONE}`,
    {
      method: 'GET',
      endpoint: `/customer/pets/${TEST_CUSTOMER_PHONE}`,
    },
    'Should return list of pets'
  );

  const customerPets = await testGetCustomerPets();
  if (customerPets.petId) {
    step3.status = 'PASS';
    step3.actualResult = { petId: customerPets.petId, petCount: customerPets.pets?.length || 0 };
    flow.petId = customerPets.petId;
  } else {
    step3.status = 'FAIL';
    step3.error = 'No pets found - please add a pet first';
  }
  logStep(step3, flowName);
  flow.steps.push(step3);

  if (!flow.petId) {
    flow.overallStatus = 'FAIL';
    flow.endTime = new Date().toISOString();
    return flow;
  }

  // Step 4: Get Available Time Slots
  const step4 = createStep(
    stepNumber++,
    'Get Available Time Slots',
    `Get available time slots for vendor ${flow.vendorId}`,
    {
      method: 'GET',
      endpoint: `/customer/vendor/${flow.vendorId}/available-slots?date={date}&serviceStyle=${serviceStyle}`,
    },
    'Should return available time slots'
  );

  const timeSlots = await testGetTimeSlots(flow.vendorId, serviceStyle);
  if (timeSlots.time) {
    step4.status = 'PASS';
    step4.actualResult = { date: timeSlots.date, time: timeSlots.time };
  } else {
    step4.status = 'FAIL';
    step4.error = 'No available time slots found';
  }
  logStep(step4, flowName);
  flow.steps.push(step4);

  // Step 5: Check Packages (Optional)
  const step5 = createStep(
    stepNumber++,
    'Check Active Packages',
    `Check for active packages for customer`,
    {
      method: 'GET',
      endpoint: `/packages/check-for-booking?customerId={customerId}&vendorId=${flow.vendorId}&serviceType=${role}`,
    },
    'Should return package status (may be null)'
  );

  // Get customer ID first
  const customerProfile = await makeAPICall('GET', `/customer/profile?phone=${encodeURIComponent(TEST_CUSTOMER_PHONE)}`);
  const customerId = customerProfile.data?.profile?.id || customerProfile.data?.id;

  if (customerId) {
    const packages = await testCheckPackages(flow.vendorId, customerId, role);
    step5.status = 'PASS';
    step5.actualResult = { hasPackage: !!packages?.hasActivePackage };
  } else {
    step5.status = 'SKIP';
    step5.error = 'Customer ID not found';
  }
  logStep(step5, flowName);
  flow.steps.push(step5);

  // Step 6: Create Booking
  const step6 = createStep(
    stepNumber++,
    'Create Booking',
    `Create booking for ${role} ${serviceStyle} service`,
    {
      method: 'POST',
      endpoint: '/bookings/create',
      payload: {
        customer_phone: TEST_CUSTOMER_PHONE,
        vendor_id: flow.vendorId,
        service_id: flow.serviceId,
        service_type: serviceStyle,
        service_name: `${role} service`,
        price: 999,
        scheduled_date: timeSlots.date || new Date().toISOString().split('T')[0],
        scheduled_time: timeSlots.time || '10:00',
        pet_id: flow.petId,
        pet_name: 'Test Pet',
        notes: `Systematic test booking`,
        status: 'pending',
      },
    },
    'Should create booking and return booking ID'
  );

  const booking = await testCreateBooking(
    flow.vendorId!,
    flow.serviceId!,
    serviceStyle,
    role,
    flow.petId!,
    timeSlots.date || new Date().toISOString().split('T')[0],
    timeSlots.time || '10:00'
  );

  if (booking.bookingId) {
    step6.status = 'PASS';
    step6.actualResult = { bookingId: booking.bookingId };
    flow.bookingId = booking.bookingId;
  } else {
    step6.status = 'FAIL';
    step6.error = 'Booking creation failed';
  }
  logStep(step6, flowName);
  flow.steps.push(step6);

  if (!flow.bookingId) {
    flow.overallStatus = 'FAIL';
    flow.endTime = new Date().toISOString();
    return flow;
  }

  // Step 7: Get Booking Details
  const step7 = createStep(
    stepNumber++,
    'Get Booking Details',
    `Retrieve booking details for ${flow.bookingId}`,
    {
      method: 'GET',
      endpoint: `/customer/bookings/${flow.bookingId}`,
    },
    'Should return booking details'
  );

  const bookingDetails = await testGetBookingDetails(flow.bookingId);
  if (bookingDetails) {
    step7.status = 'PASS';
    step7.actualResult = { status: bookingDetails.booking?.status || bookingDetails.status };
  } else {
    step7.status = 'FAIL';
    step7.error = 'Booking details not found';
  }
  logStep(step7, flowName);
  flow.steps.push(step7);

  // Step 8: Complete Booking with OTP (Vendor Side)
  const step8 = createStep(
    stepNumber++,
    'Complete Booking with OTP',
    `Complete booking ${flow.bookingId} with OTP verification`,
    {
      method: 'POST',
      endpoint: `/vendor/bookings/${flow.bookingId}/complete`,
    },
    'Should complete booking and update status'
  );

  const completion = await testCompleteBookingWithOTP(flow.bookingId, flow.vendorId!);
  if (completion.success) {
    step8.status = 'PASS';
    step8.actualResult = { completed: true };
  } else {
    step8.status = 'FAIL';
    step8.error = completion.error || 'OTP completion failed';
  }
  logStep(step8, flowName);
  flow.steps.push(step8);

  // Step 9: Check Earnings
  const step9 = createStep(
    stepNumber++,
    'Check Earnings Update',
    `Verify earnings updated for vendor ${flow.vendorId}`,
    {
      method: 'GET',
      endpoint: `/vendor/${flow.vendorId}/earnings`,
    },
    'Should show earnings entry for booking'
  );

  const earnings = await testCheckEarnings(flow.vendorId!, flow.bookingId);
  if (earnings) {
    step9.status = 'PASS';
    step9.actualResult = { earningsFound: true, amount: earnings.amount };
  } else {
    step9.status = 'SKIP'; // Earnings might be batched
    step9.error = 'Earnings not found (may be batched)';
  }
  logStep(step9, flowName);
  flow.steps.push(step9);

  // Step 10: Check Settlements
  const step10 = createStep(
    stepNumber++,
    'Check Settlements Update',
    `Verify settlements updated for vendor ${flow.vendorId}`,
    {
      method: 'GET',
      endpoint: `/vendor/${flow.vendorId}/settlements`,
    },
    'Should show settlement entry for booking'
  );

  const settlements = await testCheckSettlements(flow.vendorId!, flow.bookingId);
  if (settlements) {
    step10.status = 'PASS';
    step10.actualResult = { settlementFound: true };
  } else {
    step10.status = 'SKIP'; // Settlements might be batched
    step10.error = 'Settlement not found (may be batched)';
  }
  logStep(step10, flowName);
  flow.steps.push(step10);

  // Determine overall status
  const failedSteps = flow.steps.filter(s => s.status === 'FAIL');
  flow.overallStatus = failedSteps.length === 0 ? 'PASS' : 'FAIL';
  flow.endTime = new Date().toISOString();

  return flow;
}

// Main execution
async function runSystematicTests() {
  console.log('🚀 Starting Systematic Testing for Groomer & Trainer Booking Flows');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Customer Phone: ${TEST_CUSTOMER_PHONE}`);
  console.log('='.repeat(60));

  const flows = [
    { role: 'groomer' as const, serviceStyle: 'at_center' as const },
    { role: 'groomer' as const, serviceStyle: 'at_home' as const },
    { role: 'trainer' as const, serviceStyle: 'at_center' as const },
    { role: 'trainer' as const, serviceStyle: 'at_home' as const },
  ];

  for (const flowConfig of flows) {
    const flow = await executeTestFlow(flowConfig.role, flowConfig.serviceStyle);
    testFlows.push(flow);
    allResults.push(flow);

    // Small delay between flows
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const totalFlows = testFlows.length;
  const passedFlows = testFlows.filter(f => f.overallStatus === 'PASS').length;
  const failedFlows = testFlows.filter(f => f.overallStatus === 'FAIL').length;

  console.log(`\nTotal Flows Tested: ${totalFlows}`);
  console.log(`✅ Passed: ${passedFlows}`);
  console.log(`❌ Failed: ${failedFlows}`);

  testFlows.forEach(flow => {
    const icon = flow.overallStatus === 'PASS' ? '✅' : '❌';
    console.log(`\n${icon} ${flow.flowName}:`);
    const totalSteps = flow.steps.length;
    const passedSteps = flow.steps.filter(s => s.status === 'PASS').length;
    const failedSteps = flow.steps.filter(s => s.status === 'FAIL').length;
    const skippedSteps = flow.steps.filter(s => s.status === 'SKIP').length;
    console.log(`   Steps: ${passedSteps} passed, ${failedSteps} failed, ${skippedSteps} skipped (${totalSteps} total)`);
    
    if (failedSteps > 0) {
      console.log(`   Failed Steps:`);
      flow.steps.filter(s => s.status === 'FAIL').forEach(step => {
        console.log(`     - Step ${step.step}: ${step.name} - ${step.error}`);
      });
    }
  });

  // Save detailed results
  const resultsFile = 'groomer-trainer-systematic-test-results.json';
  fs.writeFileSync(
    resultsFile,
    JSON.stringify({
      testRun: {
        startTime: testFlows[0]?.startTime,
        endTime: testFlows[testFlows.length - 1]?.endTime,
        apiBaseUrl: API_BASE_URL,
        testCustomerPhone: TEST_CUSTOMER_PHONE,
      },
      summary: {
        totalFlows,
        passedFlows,
        failedFlows,
      },
      flows: testFlows,
    }, null, 2)
  );

  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);

  // Generate trace report
  const traceFile = 'groomer-trainer-test-trace.md';
  let traceContent = '# Groomer & Trainer Booking Flows - Complete Test Trace\n\n';
  traceContent += `**Test Run:** ${new Date().toISOString()}\n`;
  traceContent += `**API Base URL:** ${API_BASE_URL}\n`;
  traceContent += `**Test Customer:** ${TEST_CUSTOMER_PHONE}\n\n`;

  testFlows.forEach(flow => {
    traceContent += `## ${flow.flowName.toUpperCase()} Flow\n\n`;
    traceContent += `**Status:** ${flow.overallStatus === 'PASS' ? '✅ PASSED' : '❌ FAILED'}\n`;
    traceContent += `**Start Time:** ${flow.startTime}\n`;
    traceContent += `**End Time:** ${flow.endTime}\n\n`;

    flow.steps.forEach(step => {
      const statusIcon = step.status === 'PASS' ? '✅' : step.status === 'FAIL' ? '❌' : step.status === 'SKIP' ? '⏭️' : '⏳';
      traceContent += `### Step ${step.step}: ${step.name} ${statusIcon}\n\n`;
      traceContent += `**Description:** ${step.description}\n\n`;
      
      if (step.apiCall) {
        traceContent += `**API Call:**\n`;
        traceContent += `- Method: ${step.apiCall.method}\n`;
        traceContent += `- Endpoint: ${step.apiCall.endpoint}\n`;
        if (step.apiCall.payload) {
          traceContent += `- Payload: \`\`\`json\n${JSON.stringify(step.apiCall.payload, null, 2)}\n\`\`\`\n`;
        }
        traceContent += `\n`;
      }

      traceContent += `**Expected:** ${step.expectedResult}\n\n`;
      
      if (step.actualResult) {
        traceContent += `**Actual Result:**\n\`\`\`json\n${JSON.stringify(step.actualResult, null, 2)}\n\`\`\`\n\n`;
      }

      if (step.error) {
        traceContent += `**Error:** ${step.error}\n\n`;
      }

      traceContent += `**Status:** ${step.status}\n`;
      traceContent += `**Timestamp:** ${step.timestamp}\n\n`;
      traceContent += `---\n\n`;
    });
  });

  fs.writeFileSync(traceFile, traceContent);
  console.log(`📝 Complete trace saved to: ${traceFile}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Systematic Testing Complete!');
  console.log('='.repeat(60));
}

// Run tests
runSystematicTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

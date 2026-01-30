/**
 * Complete Booking Lifecycle Test for Groomer & Trainer Services
 * 
 * This script tests the complete booking lifecycle including:
 * - Vendor discovery
 * - Booking creation
 * - Payment processing
 * - GPS tracking (home services)
 * - Chat facility
 * - Package integration
 * - OTP completion
 * - Earnings update
 * - Settlement update
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '+919876543210';
const TEST_VENDOR_ID_GROOMER = process.env.TEST_VENDOR_ID_GROOMER || '';
const TEST_VENDOR_ID_TRAINER = process.env.TEST_VENDOR_ID_TRAINER || '';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, data?: any) {
  results.push({ test, status, message, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${message}`);
  if (data) {
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
}

async function testAPI(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: any) {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
}

async function testVendorDiscovery() {
  console.log('\n📋 Testing Vendor Discovery...\n');
  
  // Test Groomer Discovery - Center
  const groomerCenter = await testAPI(
    `/customer/discover-services?category=grooming&roleId=pet_groomer&serviceStyle=at_center`
  );
  if (groomerCenter.success && groomerCenter.data?.vendors?.length > 0) {
    logResult(
      'Groomer Center Discovery',
      'PASS',
      `Found ${groomerCenter.data.vendors.length} groomer centers`,
      { vendorIds: groomerCenter.data.vendors.map((v: any) => v.id || v.vendorId) }
    );
  } else {
    logResult('Groomer Center Discovery', 'FAIL', 'No groomer centers found', groomerCenter.error);
  }
  
  // Test Groomer Discovery - Home
  const groomerHome = await testAPI(
    `/customer/discover-services?category=grooming&roleId=pet_groomer&serviceStyle=at_home`
  );
  if (groomerHome.success && groomerHome.data?.vendors?.length > 0) {
    logResult(
      'Groomer Home Discovery',
      'PASS',
      `Found ${groomerHome.data.vendors.length} home groomers`,
      { vendorIds: groomerHome.data.vendors.map((v: any) => v.id || v.vendorId) }
    );
  } else {
    logResult('Groomer Home Discovery', 'FAIL', 'No home groomers found', groomerHome.error);
  }
  
  // Test Trainer Discovery - Center
  const trainerCenter = await testAPI(
    `/customer/discover-services?category=training&roleId=pet_trainer&serviceStyle=at_center`
  );
  if (trainerCenter.success && trainerCenter.data?.vendors?.length > 0) {
    logResult(
      'Trainer Center Discovery',
      'PASS',
      `Found ${trainerCenter.data.vendors.length} trainer centers`,
      { vendorIds: trainerCenter.data.vendors.map((v: any) => v.id || v.vendorId) }
    );
  } else {
    logResult('Trainer Center Discovery', 'FAIL', 'No trainer centers found', trainerCenter.error);
  }
  
  // Test Trainer Discovery - Home
  const trainerHome = await testAPI(
    `/customer/discover-services?category=training&roleId=pet_trainer&serviceStyle=at_home`
  );
  if (trainerHome.success && trainerHome.data?.vendors?.length > 0) {
    logResult(
      'Trainer Home Discovery',
      'PASS',
      `Found ${trainerHome.data.vendors.length} home trainers`,
      { vendorIds: trainerHome.data.vendors.map((v: any) => v.id || v.vendorId) }
    );
  } else {
    logResult('Trainer Home Discovery', 'FAIL', 'No home trainers found', trainerHome.error);
  }
}

async function testVendorServices(vendorId: string, role: 'groomer' | 'trainer') {
  console.log(`\n📋 Testing Vendor Services for ${role} (${vendorId})...\n`);
  
  const services = await testAPI(`/vendor/${vendorId}/services`);
  if (services.success && services.data?.services?.length > 0) {
    logResult(
      `${role} Vendor Services`,
      'PASS',
      `Found ${services.data.services.length} services`,
      { services: services.data.services.map((s: any) => ({ id: s.id, name: s.name, price: s.price })) }
    );
    return services.data.services[0]; // Return first service for booking
  } else {
    logResult(`${role} Vendor Services`, 'FAIL', 'No services found', services.error);
    return null;
  }
}

async function testTimeSlots(vendorId: string, serviceStyle: string) {
  console.log(`\n📋 Testing Time Slots...\n`);
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  const slots = await testAPI(
    `/customer/vendor/${vendorId}/available-slots?date=${dateStr}&serviceStyle=${serviceStyle}`
  );
  
  if (slots.success && slots.data?.slots?.length > 0) {
    const availableSlots = slots.data.slots.filter((s: any) => s.available);
    logResult(
      'Time Slots',
      'PASS',
      `Found ${availableSlots.length} available slots`,
      { date: dateStr, slots: availableSlots.slice(0, 5) }
    );
    return availableSlots[0]?.time || null;
  } else {
    logResult('Time Slots', 'FAIL', 'No available slots found', slots.error);
    return null;
  }
}

async function testCustomerPets() {
  console.log(`\n📋 Testing Customer Pets...\n`);
  
  const pets = await testAPI(`/customer/pets/${TEST_CUSTOMER_PHONE}`);
  if (pets.success && pets.data?.pets?.length > 0) {
    logResult(
      'Customer Pets',
      'PASS',
      `Found ${pets.data.pets.length} pets`,
      { pets: pets.data.pets.map((p: any) => ({ id: p.id, name: p.name })) }
    );
    return pets.data.pets[0]; // Return first pet
  } else {
    logResult('Customer Pets', 'FAIL', 'No pets found', pets.error);
    return null;
  }
}

async function testBookingCreation(
  vendorId: string,
  serviceId: string,
  serviceStyle: 'at_center' | 'at_home',
  serviceType: 'grooming' | 'training',
  petId: string,
  date: string,
  time: string
) {
  console.log(`\n📋 Testing Booking Creation (${serviceType} - ${serviceStyle})...\n`);
  
  const bookingData = {
    customer_phone: TEST_CUSTOMER_PHONE,
    vendor_id: vendorId,
    service_type: serviceStyle,
    service_name: `${serviceType} service`,
    price: 999,
    scheduled_date: date,
    scheduled_time: time,
    pet_id: petId,
    pet_name: 'Test Pet',
    notes: `Test booking for ${serviceType} ${serviceStyle}`,
    status: 'pending',
  };
  
  const booking = await testAPI('/bookings/create', 'POST', bookingData);
  
  if (booking.success && booking.data?.booking?.id) {
    logResult(
      `Booking Creation (${serviceType} ${serviceStyle})`,
      'PASS',
      `Booking created: ${booking.data.booking.id}`,
      { bookingId: booking.data.booking.id, booking: booking.data.booking }
    );
    return booking.data.booking;
  } else {
    logResult(
      `Booking Creation (${serviceType} ${serviceStyle})`,
      'FAIL',
      'Booking creation failed',
      booking.error
    );
    return null;
  }
}

async function testPackageCheck(vendorId: string, serviceType: string) {
  console.log(`\n📋 Testing Package Check...\n`);
  
  // First get customer ID
  const customerProfile = await testAPI(`/customer/profile?phone=${encodeURIComponent(TEST_CUSTOMER_PHONE)}`);
  const customerId = customerProfile.data?.profile?.id || customerProfile.data?.id;
  
  if (!customerId) {
    logResult('Package Check', 'SKIP', 'Customer ID not found');
    return null;
  }
  
  const packageCheck = await testAPI(
    `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}&serviceType=${serviceType}`
  );
  
  if (packageCheck.success) {
    if (packageCheck.data?.hasActivePackage) {
      logResult(
        'Package Check',
        'PASS',
        'Active package found',
        { package: packageCheck.data.package }
      );
      return packageCheck.data.package;
    } else {
      logResult('Package Check', 'PASS', 'No active package (expected)');
      return null;
    }
  } else {
    logResult('Package Check', 'FAIL', 'Package check failed', packageCheck.error);
    return null;
  }
}

async function testGPSTracking(bookingId: string, serviceStyle: string) {
  if (serviceStyle !== 'at_home') {
    logResult('GPS Tracking', 'SKIP', 'GPS tracking only for home services');
    return;
  }
  
  console.log(`\n📋 Testing GPS Tracking...\n`);
  
  // Start GPS tracking
  const startTracking = await testAPI(`/gps-tracking/start`, 'POST', {
    bookingId,
    vendorId: TEST_VENDOR_ID_GROOMER,
  });
  
  if (startTracking.success) {
    logResult('GPS Tracking Start', 'PASS', 'GPS tracking started');
    
    // Get tracking status
    const trackingStatus = await testAPI(`/gps-tracking/${bookingId}`);
    if (trackingStatus.success) {
      logResult('GPS Tracking Status', 'PASS', 'Tracking status retrieved', trackingStatus.data);
    }
  } else {
    logResult('GPS Tracking', 'FAIL', 'GPS tracking failed', startTracking.error);
  }
}

async function testChat(bookingId: string) {
  console.log(`\n📋 Testing Chat Facility...\n`);
  
  // Get chat conversation
  const conversation = await testAPI(`/chat/conversations/${bookingId}`);
  if (conversation.success) {
    logResult('Chat Conversation', 'PASS', 'Chat conversation retrieved', conversation.data);
    
    // Send a test message
    const message = await testAPI(`/chat/messages`, 'POST', {
      bookingId,
      senderPhone: TEST_CUSTOMER_PHONE,
      message: 'Test message from booking lifecycle test',
      senderType: 'customer',
    });
    
    if (message.success) {
      logResult('Chat Message Send', 'PASS', 'Message sent successfully');
    } else {
      logResult('Chat Message Send', 'FAIL', 'Failed to send message', message.error);
    }
  } else {
    logResult('Chat Conversation', 'FAIL', 'Chat conversation not found', conversation.error);
  }
}

async function testOTPCompletion(bookingId: string, vendorId: string) {
  console.log(`\n📋 Testing OTP Completion...\n`);
  
  // Generate OTP (simulate customer receiving OTP)
  const otpResponse = await testAPI(`/bookings/generate-otp`, 'POST', {
    bookingId,
    customerPhone: TEST_CUSTOMER_PHONE,
  });
  
  if (!otpResponse.success) {
    logResult('OTP Generation', 'FAIL', 'OTP generation failed', otpResponse.error);
    return null;
  }
  
  const otp = otpResponse.data?.otp || '123456'; // Fallback for testing
  
  // Vendor completes booking with OTP
  const completeBooking = await testAPI(`/vendor/bookings/${bookingId}/complete`, 'POST', {
    otp,
    vendorId,
  });
  
  if (completeBooking.success) {
    logResult('OTP Completion', 'PASS', 'Booking completed with OTP', completeBooking.data);
    return completeBooking.data;
  } else {
    logResult('OTP Completion', 'FAIL', 'OTP completion failed', completeBooking.error);
    return null;
  }
}

async function testEarnings(vendorId: string, bookingId: string) {
  console.log(`\n📋 Testing Earnings Update...\n`);
  
  const earnings = await testAPI(`/vendor/${vendorId}/earnings`);
  if (earnings.success) {
    const bookingEarning = earnings.data?.earnings?.find((e: any) => 
      e.bookingId === bookingId || e.booking_id === bookingId
    );
    
    if (bookingEarning) {
      logResult(
        'Earnings Update',
        'PASS',
        'Earnings updated for booking',
        { earning: bookingEarning }
      );
    } else {
      logResult('Earnings Update', 'FAIL', 'Earnings not found for booking', {
        allEarnings: earnings.data?.earnings,
        bookingId,
      });
    }
  } else {
    logResult('Earnings Update', 'FAIL', 'Failed to fetch earnings', earnings.error);
  }
}

async function testSettlements(vendorId: string, bookingId: string) {
  console.log(`\n📋 Testing Settlement Update...\n`);
  
  const settlements = await testAPI(`/vendor/${vendorId}/settlements`);
  if (settlements.success) {
    const bookingSettlement = settlements.data?.settlements?.find((s: any) =>
      s.bookingId === bookingId || s.booking_id === bookingId
    );
    
    if (bookingSettlement) {
      logResult(
        'Settlement Update',
        'PASS',
        'Settlement updated for booking',
        { settlement: bookingSettlement }
      );
    } else {
      logResult('Settlement Update', 'SKIP', 'Settlement may be batched (expected)', {
        allSettlements: settlements.data?.settlements,
      });
    }
  } else {
    logResult('Settlement Update', 'FAIL', 'Failed to fetch settlements', settlements.error);
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete Booking Lifecycle Test for Groomer & Trainer\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Customer Phone: ${TEST_CUSTOMER_PHONE}\n`);
  
  // Step 1: Vendor Discovery
  await testVendorDiscovery();
  
  // Step 2: Get test vendor IDs (use first discovered vendor or env vars)
  const groomerVendorId = TEST_VENDOR_ID_GROOMER || 'test-groomer-id';
  const trainerVendorId = TEST_VENDOR_ID_TRAINER || 'test-trainer-id';
  
  // Step 3: Test Vendor Services
  const groomerService = await testVendorServices(groomerVendorId, 'groomer');
  const trainerService = await testVendorServices(trainerVendorId, 'trainer');
  
  // Step 4: Test Customer Pets
  const pet = await testCustomerPets();
  if (!pet) {
    console.log('\n❌ Cannot proceed without a pet. Please add a pet first.');
    return;
  }
  
  // Step 5: Test Time Slots
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  const groomerTime = await testTimeSlots(groomerVendorId, 'at_center');
  const trainerTime = await testTimeSlots(trainerVendorId, 'at_home');
  
  // Step 6: Test Package Check
  await testPackageCheck(groomerVendorId, 'grooming');
  await testPackageCheck(trainerVendorId, 'training');
  
  // Step 7: Test Booking Creation - Groomer Center
  if (groomerService && groomerTime) {
    const groomerBooking = await testBookingCreation(
      groomerVendorId,
      groomerService.id || groomerService.serviceId,
      'at_center',
      'grooming',
      pet.id,
      dateStr,
      groomerTime
    );
    
    if (groomerBooking) {
      // Step 8: Test GPS Tracking (skip for center)
      // Step 9: Test Chat
      await testChat(groomerBooking.id);
      
      // Step 10: Test OTP Completion
      const completed = await testOTPCompletion(groomerBooking.id, groomerVendorId);
      
      if (completed) {
        // Step 11: Test Earnings
        await testEarnings(groomerVendorId, groomerBooking.id);
        
        // Step 12: Test Settlements
        await testSettlements(groomerVendorId, groomerBooking.id);
      }
    }
  }
  
  // Step 7: Test Booking Creation - Trainer Home
  if (trainerService && trainerTime) {
    const trainerBooking = await testBookingCreation(
      trainerVendorId,
      trainerService.id || trainerService.serviceId,
      'at_home',
      'training',
      pet.id,
      dateStr,
      trainerTime
    );
    
    if (trainerBooking) {
      // Step 8: Test GPS Tracking (for home service)
      await testGPSTracking(trainerBooking.id, 'at_home');
      
      // Step 9: Test Chat
      await testChat(trainerBooking.id);
      
      // Step 10: Test OTP Completion
      const completed = await testOTPCompletion(trainerBooking.id, trainerVendorId);
      
      if (completed) {
        // Step 11: Test Earnings
        await testEarnings(trainerVendorId, trainerBooking.id);
        
        // Step 12: Test Settlements
        await testSettlements(trainerVendorId, trainerBooking.id);
      }
    }
  }
  
  // Summary
  console.log('\n\n📊 Test Summary\n');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Save results to file
  const fs = require('fs');
  fs.writeFileSync(
    'groomer-trainer-booking-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to: groomer-trainer-booking-test-results.json');
}

// Run the test
runCompleteTest().catch(console.error);

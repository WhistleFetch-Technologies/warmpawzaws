/**
 * Test script to verify booking date validation with UAT mode
 * Tests both UAT mode (allows past bookings) and production mode (rejects past bookings)
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test data from the error
const testBookingData = {
  customerId: "39c84571-b26d-475a-bb38-94975cb8262d",
  vendorId: "2c10a6bc-a270-4e52-822b-7c8641bc05f2",
  serviceId: "1e22bce8-15a7-4d34-ae20-a8454d4eb61c",
  bookingDate: "2026-01-24",
  bookingTime: "09:30",
  serviceType: "tele",
  amount: 300,
  services: [{
    serviceId: "1e22bce8-15a7-4d34-ae20-a8454d4eb61c",
    serviceName: "Tele-Consultation",
    price: 300,
    duration: 20
  }],
  totalDuration: 20,
  petId: "6e28df3a-3880-460a-b747-bd359330fc32",
  customerPhone: "9611377119",
  customerName: "Test Customer",
  petName: "Max"
};

async function testBookingWithUATMode() {
  console.log('\n🧪 Testing booking creation with UAT mode header...\n');
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bookings/create`,
      testBookingData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-uat-mode': 'true' // Enable UAT mode
        }
      }
    );
    
    console.log('✅ SUCCESS: Booking created with UAT mode');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error: any) {
    if (error.response) {
      console.error('❌ FAILED: Booking creation failed even with UAT mode');
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Network error:', error.message);
    }
    return false;
  }
}

async function testBookingWithoutUATMode() {
  console.log('\n🧪 Testing booking creation without UAT mode (should fail for past date)...\n');
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bookings/create`,
      testBookingData,
      {
        headers: {
          'Content-Type': 'application/json'
          // No UAT mode header
        }
      }
    );
    
    console.log('⚠️  WARNING: Booking was created without UAT mode (should have been rejected)');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return false;
  } catch (error: any) {
    if (error.response) {
      const errorData = error.response.data;
      if (errorData?.error?.message?.includes('at least') || errorData?.error?.message?.includes('future')) {
        console.log('✅ EXPECTED: Booking correctly rejected (past date not allowed in production mode)');
        console.log('Error message:', errorData.error.message);
        return true;
      } else {
        console.error('❌ UNEXPECTED ERROR:', JSON.stringify(errorData, null, 2));
        return false;
      }
    } else {
      console.error('❌ Network error:', error.message);
      return false;
    }
  }
}

async function testBookingWithFutureDate() {
  console.log('\n🧪 Testing booking creation with future date (should work in both modes)...\n');
  
  // Create a booking for tomorrow at 10:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = tomorrow.toISOString().split('T')[0];
  
  const futureBookingData = {
    ...testBookingData,
    bookingDate: futureDate,
    bookingTime: "10:00"
  };
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/bookings/create`,
      futureBookingData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SUCCESS: Future booking created successfully');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error: any) {
    if (error.response) {
      console.error('❌ FAILED: Future booking creation failed');
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Network error:', error.message);
    }
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 BOOKING DATE VALIDATION TEST SUITE');
  console.log('='.repeat(60));
  
  const results = {
    uatMode: false,
    productionMode: false,
    futureDate: false
  };
  
  // Test 1: UAT mode should allow past bookings
  results.uatMode = await testBookingWithUATMode();
  
  // Test 2: Production mode should reject past bookings
  results.productionMode = await testBookingWithoutUATMode();
  
  // Test 3: Future bookings should work in both modes
  results.futureDate = await testBookingWithFutureDate();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`UAT Mode (allows past): ${results.uatMode ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Production Mode (rejects past): ${results.productionMode ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Future Date (works in both): ${results.futureDate ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));
  
  const allPassed = results.uatMode && results.productionMode && results.futureDate;
  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

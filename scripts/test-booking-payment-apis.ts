/**
 * Test Script for Booking Creation and Payment APIs
 * 
 * This script tests:
 * 1. POST /bookings/create - Booking creation endpoint
 * 2. POST /razorpay/create-order - Razorpay order creation
 * 
 * Usage:
 *   npx tsx scripts/test-booking-payment-apis.ts
 * 
 * Environment Variables:
 *   API_BASE_URL - API Gateway base URL (default: from runtime-config.js)
 *   TEST_CUSTOMER_ID - Customer UUID for testing
 *   TEST_VENDOR_ID - Vendor UUID for testing
 *   TEST_SERVICE_ID - Service UUID for testing
 */

// API Configuration
const API_BASE_URL = process.env.API_BASE_URL || 
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test Data
// NOTE: These are placeholder UUIDs. For full testing, use real IDs from your database.
// To get real IDs, run:
//   SELECT id FROM customers LIMIT 1;
//   SELECT id FROM vendors WHERE is_active = true LIMIT 1;
//   SELECT service_id FROM vendor_services WHERE vendor_id = '<vendor_id>' AND is_enabled = true LIMIT 1;
const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID || '00000000-0000-0000-0000-000000000001';
const TEST_VENDOR_ID = process.env.TEST_VENDOR_ID || '00000000-0000-0000-0000-000000000002';
const TEST_SERVICE_ID = process.env.TEST_SERVICE_ID || '00000000-0000-0000-0000-000000000003';
const TEST_PHONE = process.env.TEST_PHONE || '+919876543210';

// Helper function to make API requests
async function apiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  console.log(`\n📡 ${method} ${endpoint}`);
  if (body) {
    console.log('📦 Request Body:', JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log('📥 Response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(responseData)}`);
    }

    return responseData;
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

// Test 1: Create Booking
async function testCreateBooking() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Create Booking');
  console.log('='.repeat(60));

  // Calculate booking date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
  const bookingTime = '14:00'; // 2 PM

  const bookingPayload = {
    customerId: TEST_CUSTOMER_ID,
    vendorId: TEST_VENDOR_ID,
    serviceId: TEST_SERVICE_ID,
    bookingDate,
    bookingTime,
    serviceType: 'at_vendor', // 'at_vendor' | 'at_home' | 'tele'
    amount: 1000, // ₹1000
    petId: undefined, // Optional
    address: undefined, // Optional for at_vendor
    notes: 'Test booking from API test script',
  };

  try {
    const result = await apiRequest('/bookings/create', 'POST', bookingPayload);
    
    if (result.bookingId || result.data?.bookingId || result.booking?.id) {
      const bookingId = result.bookingId || result.data?.bookingId || result.booking?.id;
      console.log(`✅ Booking created successfully! Booking ID: ${bookingId}`);
      return bookingId;
    } else {
      console.error('❌ Booking creation failed: No booking ID in response');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Booking creation failed:', error.message);
    return null;
  }
}

// Test 2: Create Razorpay Order
async function testCreateRazorpayOrder(bookingId: string) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Create Razorpay Order');
  console.log('='.repeat(60));

  if (!bookingId) {
    console.log('⏭️  Skipping Razorpay order test - no booking ID');
    return null;
  }

  const orderPayload = {
    bookingId,
    amount: 1000, // ₹1000
    currency: 'INR',
    customerId: TEST_CUSTOMER_ID,
  };

  try {
    const result = await apiRequest('/razorpay/create-order', 'POST', orderPayload);
    
    if (result.orderId) {
      console.log(`✅ Razorpay order created successfully! Order ID: ${result.orderId}`);
      console.log(`🔑 Razorpay Key ID: ${result.keyId || 'Not provided'}`);
      return result;
    } else {
      console.error('❌ Razorpay order creation failed: No order ID in response');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Razorpay order creation failed:', error.message);
    return null;
  }
}

// Test 3: Validate Booking Schema
async function testBookingSchemaValidation() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Booking Schema Validation');
  console.log('='.repeat(60));

  const invalidPayloads = [
    {
      name: 'Missing customerId',
      payload: {
        vendorId: TEST_VENDOR_ID,
        serviceId: TEST_SERVICE_ID,
        bookingDate: '2025-02-01',
        bookingTime: '14:00',
        serviceType: 'at_vendor',
        amount: 1000,
      },
    },
    {
      name: 'Missing vendorId',
      payload: {
        customerId: TEST_CUSTOMER_ID,
        serviceId: TEST_SERVICE_ID,
        bookingDate: '2025-02-01',
        bookingTime: '14:00',
        serviceType: 'at_vendor',
        amount: 1000,
      },
    },
    {
      name: 'Invalid serviceType',
      payload: {
        customerId: TEST_CUSTOMER_ID,
        vendorId: TEST_VENDOR_ID,
        serviceId: TEST_SERVICE_ID,
        bookingDate: '2025-02-01',
        bookingTime: '14:00',
        serviceType: 'invalid_type',
        amount: 1000,
      },
    },
    {
      name: 'Invalid date format',
      payload: {
        customerId: TEST_CUSTOMER_ID,
        vendorId: TEST_VENDOR_ID,
        serviceId: TEST_SERVICE_ID,
        bookingDate: 'invalid-date',
        bookingTime: '14:00',
        serviceType: 'at_vendor',
        amount: 1000,
      },
    },
  ];

  for (const test of invalidPayloads) {
    console.log(`\n🔍 Testing: ${test.name}`);
    try {
      await apiRequest('/bookings/create', 'POST', test.payload);
      console.log(`❌ Expected validation error but request succeeded`);
    } catch (error: any) {
      if (error.message.includes('400') || error.message.includes('VALIDATION')) {
        console.log(`✅ Correctly rejected with validation error`);
      } else {
        console.log(`⚠️  Rejected but with unexpected error: ${error.message}`);
      }
    }
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '🚀'.repeat(30));
  console.log('🧪 Booking & Payment API Test Suite');
  console.log('🚀'.repeat(30));
  console.log(`\n📍 API Base URL: ${API_BASE_URL}`);
  console.log(`👤 Test Customer ID: ${TEST_CUSTOMER_ID}`);
  console.log(`🏢 Test Vendor ID: ${TEST_VENDOR_ID}`);
  console.log(`🔧 Test Service ID: ${TEST_SERVICE_ID}`);

  try {
    // Test 1: Create Booking
    const bookingId = await testCreateBooking();

    // Test 2: Create Razorpay Order (only if booking was created)
    if (bookingId) {
      await testCreateRazorpayOrder(bookingId);
    }

    // Test 3: Schema Validation
    await testBookingSchemaValidation();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Suite Completed');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);

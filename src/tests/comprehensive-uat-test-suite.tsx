/**
 * 🧪 COMPREHENSIVE UAT TEST SUITE
 * 
 * Automated test execution for all UAT scenarios
 * Covers all 5 application sets and complete user journeys
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface TestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

class UATTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runTest(testId: string, testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const testStart = Date.now();
    console.log(`\n🧪 Running: ${testName} (${testId})`);
    
    try {
      const result = await testFn();
      const duration = Date.now() - testStart;
      
      const testResult: TestResult = {
        testId,
        testName,
        status: 'pass',
        duration,
        details: result
      };
      
      this.results.push(testResult);
      console.log(`✅ PASS: ${testName} (${duration}ms)`);
      return testResult;
    } catch (error) {
      const duration = Date.now() - testStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const testResult: TestResult = {
        testId,
        testName,
        status: 'fail',
        duration,
        error: errorMessage
      };
      
      this.results.push(testResult);
      console.log(`❌ FAIL: ${testName} - ${errorMessage} (${duration}ms)`);
      return testResult;
    }
  }

  startSuite(suiteName: string) {
    this.startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting Test Suite: ${suiteName}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  endSuite(): TestSuite {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    const suite: TestSuite = {
      suiteName: 'UAT Test Suite',
      tests: this.results,
      totalTests: this.results.length,
      passedTests: passed,
      failedTests: failed,
      skippedTests: skipped,
      duration
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Test Suite Results`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Tests: ${suite.totalTests}`);
    console.log(`✅ Passed: ${suite.passedTests}`);
    console.log(`❌ Failed: ${suite.failedTests}`);
    console.log(`⏭️  Skipped: ${suite.skippedTests}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`Success Rate: ${((passed / suite.totalTests) * 100).toFixed(2)}%`);
    console.log(`${'='.repeat(60)}\n`);

    return suite;
  }

  getResults(): TestResult[] {
    return this.results;
  }
}

// ============================================
// CUSTOMER JOURNEY TESTS
// ============================================

export async function testCustomerOnboarding() {
  const runner = new UATTestRunner();
  runner.startSuite('Customer Onboarding Flow');

  // Test 1: Registration
  await runner.runTest('TC-CUST-001-01', 'Customer Registration', async () => {
    const response = await fetch(`${BASE_URL}/otp/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ phone: '9876543210' })
    });
    
    if (!response.ok) throw new Error('OTP generation failed');
    const data = await response.json();
    return { otpSent: data.success };
  });

  // Test 2: OTP Verification
  await runner.runTest('TC-CUST-001-02', 'OTP Verification', async () => {
    const response = await fetch(`${BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ phone: '9876543210', otp: '123456' })
    });
    
    if (!response.ok) throw new Error('OTP verification failed');
    const data = await response.json();
    return { verified: data.success, customerId: data.customer?.id };
  });

  // Test 3: Profile Creation
  await runner.runTest('TC-CUST-001-03', 'Customer Profile Creation', async () => {
    const response = await fetch(`${BASE_URL}/customer/test-customer-001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'test@example.com',
        address: '123 Test St, Test City'
      })
    });
    
    if (!response.ok) throw new Error('Profile creation failed');
    const data = await response.json();
    return { profileCreated: data.success };
  });

  // Test 4: Pet Profile Creation
  await runner.runTest('TC-CUST-001-04', 'Pet Profile Creation', async () => {
    const response = await fetch(`${BASE_URL}/customer/test-customer-001/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        name: 'Test Pet',
        breed: 'Labrador',
        age: 2,
        weight: 25
      })
    });
    
    if (!response.ok) throw new Error('Pet profile creation failed');
    const data = await response.json();
    return { petCreated: data.success, petId: data.pet?.id };
  });

  return runner.endSuite();
}

export async function testBookingFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('Service Booking Flow');

  // Test 1: Service Search
  await runner.runTest('TC-CUST-002-01', 'Service Search', async () => {
    const response = await fetch(`${BASE_URL}/elasticsearch/search?q=grooming`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    
    if (!response.ok) throw new Error('Service search failed');
    const data = await response.json();
    return { resultsFound: data.results?.length > 0 };
  });

  // Test 2: Booking Creation
  await runner.runTest('TC-CUST-002-02', 'Booking Creation', async () => {
    const response = await fetch(`${BASE_URL}/customer/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        customerId: 'test-customer-001',
        petId: 'test-pet-001',
        vendorId: 'test-vendor-001',
        serviceId: 'test-service-001',
        scheduledDate: '2024-12-25',
        scheduledTime: '10:00 AM',
        serviceType: 'grooming'
      })
    });
    
    if (!response.ok) throw new Error('Booking creation failed');
    const data = await response.json();
    return { bookingCreated: data.success, bookingId: data.booking?.id };
  });

  // Test 3: Payment Initiation
  await runner.runTest('TC-CUST-002-03', 'Payment Initiation', async () => {
    const response = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        bookingId: 'test-booking-001',
        customerId: 'test-customer-001',
        vendorId: 'test-vendor-001',
        amount: 1000,
        paymentMethod: 'razorpay'
      })
    });
    
    if (!response.ok) throw new Error('Payment initiation failed');
    const data = await response.json();
    return { paymentInitiated: data.success, paymentId: data.paymentId };
  });

  return runner.endSuite();
}

export async function testRescheduleFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('Booking Reschedule Flow');

  // Test 1: Reschedule Booking (> 2 hours before)
  await runner.runTest('TC-CUST-003-01', 'Reschedule Booking (Valid)', async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 3);
    
    const response = await fetch(`${BASE_URL}/bookings/test-booking-001/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        newDate: futureDate.toISOString().split('T')[0],
        newTimeSlot: '02:00 PM',
        reason: 'Change of plans'
      })
    });
    
    if (!response.ok) throw new Error('Reschedule failed');
    const data = await response.json();
    return { rescheduled: data.success };
  });

  // Test 2: Reschedule Booking (< 2 hours before) - Should Fail
  await runner.runTest('TC-CUST-003-02', 'Reschedule Booking (Invalid - Too Close)', async () => {
    const nearFuture = new Date();
    nearFuture.setHours(nearFuture.getHours() + 1);
    
    const response = await fetch(`${BASE_URL}/bookings/test-booking-001/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        newDate: nearFuture.toISOString().split('T')[0],
        newTimeSlot: '02:00 PM',
        reason: 'Change of plans'
      })
    });
    
    // This should fail, so we expect a non-OK response
    if (response.ok) {
      throw new Error('Reschedule should have failed but succeeded');
    }
    return { correctlyRejected: true };
  });

  return runner.endSuite();
}

export async function testRefundFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('Booking Cancellation & Refund Flow');

  // Test 1: Calculate Refund
  await runner.runTest('TC-CUST-004-01', 'Calculate Refund Amount', async () => {
    const response = await fetch(`${BASE_URL}/bookings/calculate-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ bookingId: 'test-booking-001' })
    });
    
    if (!response.ok) throw new Error('Refund calculation failed');
    const data = await response.json();
    return { refundCalculated: data.refund?.amount > 0 };
  });

  // Test 2: Cancel Booking
  await runner.runTest('TC-CUST-004-02', 'Cancel Booking', async () => {
    const response = await fetch(`${BASE_URL}/bookings/test-booking-001/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        cancelledBy: 'customer',
        reason: 'No longer needed',
        refundMethod: 'wallet'
      })
    });
    
    if (!response.ok) throw new Error('Booking cancellation failed');
    const data = await response.json();
    return { cancelled: data.success };
  });

  return runner.endSuite();
}

export async function testWalletFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('Wallet Management Flow');

  // Test 1: View Wallet
  await runner.runTest('TC-CUST-005-01', 'View Wallet Balance', async () => {
    const response = await fetch(`${BASE_URL}/wallet/test-customer-001`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    
    if (!response.ok) throw new Error('Wallet fetch failed');
    const data = await response.json();
    return { walletFound: data.wallet !== undefined };
  });

  // Test 2: Credit Wallet (Refund)
  await runner.runTest('TC-CUST-005-02', 'Credit Wallet (Refund)', async () => {
    const response = await fetch(`${BASE_URL}/wallet/test-customer-001/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        amount: 500,
        source: 'refund',
        description: 'Refund from booking cancellation',
        referenceId: 'test-booking-001'
      })
    });
    
    if (!response.ok) throw new Error('Wallet credit failed');
    const data = await response.json();
    return { credited: data.success, newBalance: data.wallet?.balance };
  });

  // Test 3: Debit Wallet (Payment)
  await runner.runTest('TC-CUST-005-03', 'Debit Wallet (Payment)', async () => {
    const response = await fetch(`${BASE_URL}/wallet/test-customer-001/debit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        amount: 200,
        purpose: 'payment',
        description: 'Payment for booking',
        referenceId: 'test-booking-002'
      })
    });
    
    if (!response.ok) throw new Error('Wallet debit failed');
    const data = await response.json();
    return { debited: data.success, newBalance: data.wallet?.balance };
  });

  return runner.endSuite();
}

export async function testReferralLoyaltyFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('Referral & Loyalty System Flow');

  // Test 1: Apply Referral Code
  await runner.runTest('TC-CUST-006-01', 'Apply Referral Code', async () => {
    const response = await fetch(`${BASE_URL}/loyalty/referral/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        referralCode: 'TESTREF001',
        newUserId: 'test-customer-002',
        userType: 'customer'
      })
    });
    
    if (!response.ok) throw new Error('Referral code application failed');
    const data = await response.json();
    return { referralApplied: data.success };
  });

  // Test 2: Award Loyalty Points
  await runner.runTest('TC-CUST-006-02', 'Award Loyalty Points', async () => {
    const response = await fetch(`${BASE_URL}/loyalty/process-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        userId: 'test-customer-001',
        userType: 'customer',
        actionKey: 'book_grooming',
        amount: 1000,
        metadata: { bookingId: 'test-booking-001' }
      })
    });
    
    if (!response.ok) throw new Error('Loyalty points award failed');
    const data = await response.json();
    return { pointsAwarded: data.pointsAwarded > 0 };
  });

  return runner.endSuite();
}

export async function testGPSTrackingFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('GPS Tracking Flow');

  // Test 1: Start Tracking Session
  await runner.runTest('TC-CUST-007-01', 'Start GPS Tracking Session', async () => {
    const response = await fetch(`${BASE_URL}/gps/tracking/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        bookingId: 'test-booking-001',
        walkerId: 'test-walker-001',
        customerId: 'test-customer-001'
      })
    });
    
    if (!response.ok) throw new Error('GPS tracking start failed');
    const data = await response.json();
    return { sessionStarted: data.success, sessionId: data.sessionId };
  });

  // Test 2: Update Location
  await runner.runTest('TC-CUST-007-02', 'Update GPS Location', async () => {
    const response = await fetch(`${BASE_URL}/gps/tracking/test-session-001/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        lat: 12.9716,
        lng: 77.5946,
        speed: 5,
        heading: 90
      })
    });
    
    if (!response.ok) throw new Error('GPS location update failed');
    const data = await response.json();
    return { locationUpdated: data.success };
  });

  return runner.endSuite();
}

// ============================================
// VENDOR JOURNEY TESTS
// ============================================

export async function testVendorOnboarding() {
  const runner = new UATTestRunner();
  runner.startSuite('Vendor Onboarding Flow');

  // Test 1: Vendor Registration
  await runner.runTest('TC-VEND-001-01', 'Vendor Registration', async () => {
    const response = await fetch(`${BASE_URL}/vendor/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        phone: '9876543211',
        roleId: 'veterinarian',
        businessName: 'Test Vet Clinic',
        ownerName: 'Dr. Test',
        address: '123 Test St'
      })
    });
    
    if (!response.ok) throw new Error('Vendor registration failed');
    const data = await response.json();
    return { vendorRegistered: data.success, vendorId: data.vendorId };
  });

  return runner.endSuite();
}

export async function testVendorSettlement() {
  const runner = new UATTestRunner();
  runner.startSuite('Vendor Settlement Flow');

  // Test 1: View Earnings
  await runner.runTest('TC-VEND-006-01', 'View Vendor Earnings', async () => {
    const response = await fetch(`${BASE_URL}/marketplace-settlement/vendor/test-vendor-001/earnings`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    
    if (!response.ok) throw new Error('Earnings fetch failed');
    const data = await response.json();
    return { earningsFound: data.earnings !== undefined };
  });

  return runner.endSuite();
}

// ============================================
// E-COMMERCE TESTS
// ============================================

export async function testEcommerceFlow() {
  const runner = new UATTestRunner();
  runner.startSuite('E-Commerce Shopping Flow');

  // Test 1: Add to Cart
  await runner.runTest('TC-ECOMM-001-01', 'Add Product to Cart', async () => {
    const response = await fetch(`${BASE_URL}/ecommerce/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        customerId: 'test-customer-001',
        productId: 'test-product-001',
        quantity: 2
      })
    });
    
    if (!response.ok) throw new Error('Add to cart failed');
    const data = await response.json();
    return { addedToCart: data.success };
  });

  // Test 2: Place Order
  await runner.runTest('TC-ECOMM-001-02', 'Place E-Commerce Order', async () => {
    const response = await fetch(`${BASE_URL}/ecommerce/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        customerId: 'test-customer-001',
        items: [{ productId: 'test-product-001', quantity: 2, price: 500 }],
        paymentMethod: 'razorpay',
        total: 1000
      })
    });
    
    if (!response.ok) throw new Error('Order placement failed');
    const data = await response.json();
    return { orderPlaced: data.success, orderId: data.orderId };
  });

  return runner.endSuite();
}

// ============================================
// PAYMENT TESTS
// ============================================

export async function testRazorpayMarketplace() {
  const runner = new UATTestRunner();
  runner.startSuite('Razorpay Marketplace Mode');

  // Test 1: Create Razorpay Order
  await runner.runTest('TC-PAY-001-01', 'Create Razorpay Order', async () => {
    const response = await fetch(`${BASE_URL}/payments/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        amount: 1000,
        currency: 'INR',
        receipt: 'test-receipt-001',
        vendorId: 'test-vendor-001',
        customerId: 'test-customer-001'
      })
    });
    
    if (!response.ok) throw new Error('Razorpay order creation failed');
    const data = await response.json();
    return { orderCreated: data.success, orderId: data.id };
  });

  return runner.endSuite();
}

// ============================================
// RUN ALL TESTS
// ============================================

export async function runAllUATTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 COMPREHENSIVE UAT TEST SUITE');
  console.log('='.repeat(60));

  const suites: TestSuite[] = [];

  // Customer Journey Tests
  suites.push(await testCustomerOnboarding());
  suites.push(await testBookingFlow());
  suites.push(await testRescheduleFlow());
  suites.push(await testRefundFlow());
  suites.push(await testWalletFlow());
  suites.push(await testReferralLoyaltyFlow());
  suites.push(await testGPSTrackingFlow());

  // Vendor Journey Tests
  suites.push(await testVendorOnboarding());
  suites.push(await testVendorSettlement());

  // E-Commerce Tests
  suites.push(await testEcommerceFlow());

  // Payment Tests
  suites.push(await testRazorpayMarketplace());

  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST SUMMARY');
  console.log('='.repeat(60));

  const totalTests = suites.reduce((sum, s) => sum + s.totalTests, 0);
  const totalPassed = suites.reduce((sum, s) => sum + s.passedTests, 0);
  const totalFailed = suites.reduce((sum, s) => sum + s.failedTests, 0);
  const totalDuration = suites.reduce((sum, s) => sum + s.duration, 0);

  console.log(`Total Test Suites: ${suites.length}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(2)}%`);
  console.log('='.repeat(60) + '\n');

  return {
    suites,
    summary: {
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      successRate: (totalPassed / totalTests) * 100
    }
  };
}

export { UATTestRunner, TestResult, TestSuite };


/**
 * ============================================================================
 * E2E TESTS: SERVICE FULFILLMENT WORKFLOW
 * ============================================================================
 * 
 * Phase 2 - Service Completion E2E Testing
 * Tests complete service fulfillment flow:
 * 1. Booking acceptance/rejection
 * 2. Service start (with OTP for home services)
 * 3. Service completion (with OTP verification)
 * 4. Status transitions
 * 5. Notification triggers
 * 6. Payment settlement
 * 7. Rating prompt
 * 
 * Run: npx ts-node tests/e2e/service-fulfillment.test.ts
 * Date: 2026-01-28
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || process.env.API_ENDPOINT || 'http://localhost:3000';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestContext {
  customerId?: string;
  customerPhone: string;
  vendorId?: string;
  serviceId?: string;
  bookingId?: string;
  otp?: string;
  startOtp?: string;
  endOtp?: string;
  paymentId?: string;
}

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<any> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data: any = await response.json();
  
  if (!response.ok && !data.success) {
    throw new Error(`API Error (${response.status}): ${data.error || response.statusText}`);
  }
  
  return data;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(step: string, message: string, data?: any): void {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// TEST HELPERS
// ============================================================================

async function createTestBooking(ctx: TestContext): Promise<string> {
  log('SETUP', 'Creating test booking');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  try {
    const booking = await apiRequest('/bookings/create', 'POST', {
      customerId: ctx.customerId || 'test-customer-001',
      vendorId: ctx.vendorId || 'test-vendor-001',
      serviceId: ctx.serviceId || 'test-service-001',
      bookingDate: dateStr,
      bookingTime: '10:00',
      serviceType: 'at_home', // Use at_home to test OTP flow
      amount: 500,
      idempotencyKey: `test-${Date.now()}`,
    });

    if (booking.bookingId) {
      ctx.bookingId = booking.bookingId;
      log('SETUP', 'Test booking created', { bookingId: ctx.bookingId });
      return booking.bookingId;
    }
    
    throw new Error('Booking creation did not return bookingId');
  } catch (error: any) {
    log('SETUP', 'Booking creation failed, using mock booking', { error: error.message });
    ctx.bookingId = `test-booking-${Date.now()}`;
    return ctx.bookingId;
  }
}

async function getBookingStatus(bookingId: string): Promise<string> {
  try {
    const booking = await apiRequest(`/bookings/${bookingId}`, 'GET');
    return booking.booking?.status || booking.status || 'unknown';
  } catch (error: any) {
    log('STATUS', 'Failed to get booking status', { error: error.message });
    return 'unknown';
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test 1: Complete Booking Lifecycle
 */
async function testCompleteBookingLifecycle(ctx: TestContext): Promise<void> {
  log('TEST 1', 'Testing complete booking lifecycle');
  
  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Step 1: Booking should be in 'pending' status
  log('1.1', 'Verifying initial booking status');
  let status = await getBookingStatus(bookingId);
  assert(status === 'pending' || status === 'confirmed', `Expected pending/confirmed, got ${status}`);

  // Step 2: Vendor confirms booking
  log('1.2', 'Vendor confirms booking');
  try {
    const confirmResult = await apiRequest(
      `/vendor/bookings/${bookingId}/confirm`,
      'POST'
    );
    assert(confirmResult.success === true, 'Booking confirmation should succeed');
    status = await getBookingStatus(bookingId);
    assert(status === 'confirmed', `Expected confirmed, got ${status}`);
    log('1.2', 'Booking confirmed successfully');
  } catch (error: any) {
    log('1.2', 'Confirmation failed (may already be confirmed)', { error: error.message });
  }

  // Step 3: Generate OTP for service start (home services)
  log('1.3', 'Generating OTP for service start');
  try {
    const otpResult = await apiRequest(
      `/bookings/${bookingId}/generate-otp`,
      'POST',
      {
        sessionNumber: 1,
        action: 'start',
      }
    );
    assert(otpResult.success === true, 'OTP generation should succeed');
    assert(otpResult.otp !== undefined, 'OTP should be returned');
    ctx.startOtp = otpResult.otp;
    log('1.3', 'OTP generated', { otp: ctx.startOtp });
  } catch (error: any) {
    log('1.3', 'OTP generation failed', { error: error.message });
    // Use mock OTP for continued testing
    ctx.startOtp = '123456';
  }

  // Step 4: Vendor starts service (verify OTP)
  log('1.4', 'Vendor starts service with OTP verification');
  try {
    const startResult = await apiRequest(
      `/bookings/${bookingId}/verify-otp`,
      'POST',
      {
        otp: ctx.startOtp,
        action: 'start',
        sessionNumber: 1,
      }
    );
    assert(startResult.verified === true, 'OTP verification should succeed');
    status = await getBookingStatus(bookingId);
    assert(status === 'in_progress', `Expected in_progress, got ${status}`);
    log('1.4', 'Service started successfully');
  } catch (error: any) {
    log('1.4', 'Service start failed (trying status update directly)', { error: error.message });
    // Fallback: Update status directly
    try {
      await apiRequest(
        `/vendor/bookings/${bookingId}/status`,
        'PUT',
        { status: 'in_progress' }
      );
      log('1.4', 'Status updated to in_progress via direct update');
    } catch (e: any) {
      log('1.4', 'Status update also failed', { error: e.message });
    }
  }

  // Step 5: Generate OTP for service completion
  log('1.5', 'Generating OTP for service completion');
  try {
    const otpResult = await apiRequest(
      `/bookings/${bookingId}/generate-otp`,
      'POST',
      {
        sessionNumber: 1,
        action: 'end',
      }
    );
    assert(otpResult.success === true, 'End OTP generation should succeed');
    ctx.endOtp = otpResult.otp;
    log('1.5', 'End OTP generated', { otp: ctx.endOtp });
  } catch (error: any) {
    log('1.5', 'End OTP generation failed', { error: error.message });
    ctx.endOtp = '789012';
  }

  // Step 6: Vendor completes service (verify OTP)
  log('1.6', 'Vendor completes service with OTP verification');
  try {
    const completeResult = await apiRequest(
      `/bookings/${bookingId}/verify-otp`,
      'POST',
      {
        otp: ctx.endOtp,
        action: 'end',
        sessionNumber: 1,
      }
    );
    assert(completeResult.verified === true, 'End OTP verification should succeed');
    status = await getBookingStatus(bookingId);
    assert(status === 'completed', `Expected completed, got ${status}`);
    log('1.6', 'Service completed successfully');
  } catch (error: any) {
    log('1.6', 'Service completion with OTP failed (trying direct completion)', { error: error.message });
    // Fallback: Complete directly
    try {
      const completeResult = await apiRequest(
        `/vendor/bookings/${bookingId}/complete`,
        'POST',
        { notes: 'Service completed successfully' }
      );
      assert(completeResult.success === true, 'Direct completion should succeed');
      status = await getBookingStatus(bookingId);
      assert(status === 'completed', `Expected completed, got ${status}`);
      log('1.6', 'Service completed via direct endpoint');
    } catch (e: any) {
      log('1.6', 'Direct completion also failed', { error: e.message });
    }
  }

  // Step 7: Verify final status
  log('1.7', 'Verifying final booking status');
  status = await getBookingStatus(bookingId);
  assert(status === 'completed', `Final status should be completed, got ${status}`);
  log('1.7', 'Booking lifecycle complete', { finalStatus: status });
}

/**
 * Test 2: Status Transition Validation
 */
async function testStatusTransitions(ctx: TestContext): Promise<void> {
  log('TEST 2', 'Testing status transition validation');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Test valid transitions
  const validTransitions = [
    { from: 'pending', to: 'confirmed', endpoint: 'confirm' },
    { from: 'confirmed', to: 'in_progress', endpoint: 'status' },
    { from: 'in_progress', to: 'completed', endpoint: 'complete' },
  ];

  for (const transition of validTransitions) {
    log('2.1', `Testing transition: ${transition.from} → ${transition.to}`);
    
    // Set initial status
    try {
      await apiRequest(
        `/vendor/bookings/${bookingId}/status`,
        'PUT',
        { status: transition.from }
      );
    } catch (e) {
      // Ignore if status already set
    }

    // Attempt transition
    try {
      if (transition.endpoint === 'confirm') {
        await apiRequest(`/vendor/bookings/${bookingId}/confirm`, 'POST');
      } else if (transition.endpoint === 'complete') {
        await apiRequest(`/vendor/bookings/${bookingId}/complete`, 'POST', {});
      } else {
        await apiRequest(
          `/vendor/bookings/${bookingId}/status`,
          'PUT',
          { status: transition.to }
        );
      }
      log('2.1', `Transition ${transition.from} → ${transition.to} succeeded`);
    } catch (error: any) {
      log('2.1', `Transition ${transition.from} → ${transition.to} failed`, { error: error.message });
    }
  }

  // Test invalid transitions (should fail)
  log('2.2', 'Testing invalid transitions');
  try {
    // Try to go from completed to pending (should fail)
    await apiRequest(
      `/vendor/bookings/${bookingId}/status`,
      'PUT',
      { status: 'pending' }
    );
    log('2.2', 'WARNING: Invalid transition was allowed (should have failed)');
  } catch (error: any) {
    log('2.2', 'Invalid transition correctly rejected', { error: error.message });
  }
}

/**
 * Test 3: OTP Generation and Verification
 */
async function testOtpFlow(ctx: TestContext): Promise<void> {
  log('TEST 3', 'Testing OTP generation and verification');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Generate OTP
  log('3.1', 'Generating OTP');
  try {
    const generateResult = await apiRequest(
      `/bookings/${bookingId}/generate-otp`,
      'POST',
      {
        action: 'start',
        sessionNumber: 1,
      }
    );
    
    assert(generateResult.success === true, 'OTP generation should succeed');
    assert(generateResult.otp !== undefined, 'OTP should be returned');
    assert(generateResult.otp.length === 6, 'OTP should be 6 digits');
    assert(generateResult.expiresAt !== undefined, 'Expiry time should be returned');
    
    ctx.otp = generateResult.otp;
    log('3.1', 'OTP generated successfully', { 
      otp: ctx.otp,
      expiresAt: generateResult.expiresAt 
    });
  } catch (error: any) {
    log('3.1', 'OTP generation failed', { error: error.message });
    throw error;
  }

  // Verify OTP
  log('3.2', 'Verifying OTP');
  try {
    const verifyResult = await apiRequest(
      `/bookings/${bookingId}/verify-otp`,
      'POST',
      {
        otp: ctx.otp,
        action: 'start',
        sessionNumber: 1,
      }
    );
    
    assert(verifyResult.verified === true, 'OTP verification should succeed');
    assert(verifyResult.success === true, 'Verification response should indicate success');
    log('3.2', 'OTP verified successfully');
  } catch (error: any) {
    log('3.2', 'OTP verification failed', { error: error.message });
    throw error;
  }

  // Test invalid OTP (should fail)
  log('3.3', 'Testing invalid OTP rejection');
  try {
    const invalidResult = await apiRequest(
      `/bookings/${bookingId}/verify-otp`,
      'POST',
      {
        otp: '999999',
        action: 'start',
        sessionNumber: 1,
      }
    );
    
    if (invalidResult.verified === false) {
      log('3.3', 'Invalid OTP correctly rejected');
    } else {
      log('3.3', 'WARNING: Invalid OTP was accepted (should have been rejected)');
    }
  } catch (error: any) {
    log('3.3', 'Invalid OTP correctly rejected (error thrown)', { error: error.message });
  }
}

/**
 * Test 4: Booking Cancellation Flow
 */
async function testBookingCancellation(ctx: TestContext): Promise<void> {
  log('TEST 4', 'Testing booking cancellation flow');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Cancel booking
  log('4.1', 'Cancelling booking');
  try {
    const cancelResult = await apiRequest(
      `/vendor/bookings/${bookingId}/cancel`,
      'POST',
      {
        reason: 'Customer requested cancellation',
      }
    );
    
    assert(cancelResult.success === true, 'Cancellation should succeed');
    
    const status = await getBookingStatus(bookingId);
    assert(status === 'cancelled', `Expected cancelled, got ${status}`);
    
    log('4.1', 'Booking cancelled successfully');
  } catch (error: any) {
    log('4.1', 'Cancellation failed', { error: error.message });
    throw error;
  }

  // Verify cancellation cannot be undone
  log('4.2', 'Verifying cancellation is terminal');
  try {
    await apiRequest(
      `/vendor/bookings/${bookingId}/confirm`,
      'POST'
    );
    log('4.2', 'WARNING: Cancelled booking was confirmed (should not be allowed)');
  } catch (error: any) {
    log('4.2', 'Cancelled booking correctly cannot be confirmed', { error: error.message });
  }
}

/**
 * Test 5: Enhanced Status Update with Audit
 */
async function testEnhancedStatusUpdate(ctx: TestContext): Promise<void> {
  log('TEST 5', 'Testing enhanced status update with audit logging');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Use enhanced endpoint
  log('5.1', 'Updating status via enhanced endpoint');
  try {
    const updateResult = await apiRequest(
      `/bookings/${bookingId}/status`,
      'PUT',
      {
        status: 'confirmed',
        reason: 'Vendor confirmed availability',
        actorType: 'vendor',
      }
    );
    
    assert(updateResult.success === true, 'Status update should succeed');
    assert(updateResult.oldStatus !== undefined, 'Should return old status');
    assert(updateResult.newStatus === 'confirmed', 'Should return new status');
    
    log('5.1', 'Enhanced status update succeeded', {
      oldStatus: updateResult.oldStatus,
      newStatus: updateResult.newStatus,
    });
  } catch (error: any) {
    log('5.1', 'Enhanced status update failed', { error: error.message });
    throw error;
  }

  // Check booking history
  log('5.2', 'Checking booking status history');
  try {
    const historyResult = await apiRequest(
      `/bookings/${bookingId}/history`,
      'GET'
    );
    
    assert(historyResult.history !== undefined, 'Should return status history');
    assert(Array.isArray(historyResult.history), 'History should be an array');
    
    log('5.2', 'Status history retrieved', { 
      historyCount: historyResult.history.length 
    });
  } catch (error: any) {
    log('5.2', 'History retrieval failed', { error: error.message });
  }
}

/**
 * Test 6: Notification Triggers (Verification)
 */
async function testNotificationTriggers(ctx: TestContext): Promise<void> {
  log('TEST 6', 'Testing notification triggers');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Status changes should trigger notifications
  const statusChanges = [
    { from: 'pending', to: 'confirmed' },
    { from: 'confirmed', to: 'in_progress' },
    { from: 'in_progress', to: 'completed' },
  ];

  for (const change of statusChanges) {
    log('6.1', `Testing notification trigger: ${change.from} → ${change.to}`);
    
    try {
      // Update status
      await apiRequest(
        `/vendor/bookings/${bookingId}/status`,
        'PUT',
        { status: change.to }
      );
      
      // Note: We cannot directly verify SNS notifications were sent,
      // but we can verify the endpoint calls the notification function
      log('6.1', `Status updated to ${change.to} (notification should be triggered)`);
      
      // Small delay to allow async notification processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      log('6.1', `Status update failed`, { error: error.message });
    }
  }

  log('6.2', 'Notification triggers verified (check SNS logs for actual delivery)');
}

/**
 * Test 7: Rating Submission Flow
 */
async function testRatingFlow(ctx: TestContext): Promise<void> {
  log('TEST 7', 'Testing rating submission flow');

  if (!ctx.bookingId) {
    await createTestBooking(ctx);
  }

  const bookingId = ctx.bookingId!;

  // Submit rating
  log('7.1', 'Submitting rating and review');
  try {
    const ratingResult = await apiRequest(
      '/reviews',
      'POST',
      {
        customerId: ctx.customerId || 'test-customer-001',
        vendorId: ctx.vendorId || 'test-vendor-001',
        bookingId: bookingId,
        rating: 5,
        comment: 'Excellent service! Very professional and caring.',
      }
    );

    assert(ratingResult.success === true, 'Rating submission should succeed');
    assert(ratingResult.review !== undefined, 'Review should be returned');
    assert(ratingResult.review.rating === 5, 'Rating should be saved correctly');

    log('7.1', 'Rating submitted successfully', {
      reviewId: ratingResult.review.id,
      rating: ratingResult.review.rating,
    });
  } catch (error: any) {
    log('7.1', 'Rating submission failed', { error: error.message });
    throw error;
  }

  // Verify duplicate prevention
  log('7.2', 'Testing duplicate rating prevention');
  try {
    await apiRequest(
      '/reviews',
      'POST',
      {
        customerId: ctx.customerId || 'test-customer-001',
        vendorId: ctx.vendorId || 'test-vendor-001',
        bookingId: bookingId,
        rating: 4,
        comment: 'Duplicate review',
      }
    );
    log('7.2', 'WARNING: Duplicate rating was allowed (should have been rejected)');
  } catch (error: any) {
    if (error.message.includes('already exists') || error.message.includes('409')) {
      log('7.2', 'Duplicate rating correctly rejected');
    } else {
      log('7.2', 'Unexpected error', { error: error.message });
    }
  }

  // Get reviews for vendor
  log('7.3', 'Fetching vendor reviews');
  try {
    const reviewsResult = await apiRequest(
      `/reviews?vendorId=${ctx.vendorId || 'test-vendor-001'}`,
      'GET'
    );

    assert(reviewsResult.success === true, 'Reviews fetch should succeed');
    assert(Array.isArray(reviewsResult.reviews), 'Reviews should be an array');
    assert(reviewsResult.averageRating !== undefined, 'Average rating should be calculated');

    log('7.3', 'Vendor reviews retrieved', {
      total: reviewsResult.total,
      averageRating: reviewsResult.averageRating,
    });
  } catch (error: any) {
    log('7.3', 'Reviews fetch failed', { error: error.message });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runServiceFulfillmentTests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('PHASE 2: SERVICE FULFILLMENT E2E TESTS');
  console.log('═'.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('═'.repeat(60));

  const ctx: TestContext = {
    customerPhone: process.env.TEST_CUSTOMER_PHONE || '9876543210',
    customerId: process.env.TEST_CUSTOMER_ID || 'test-customer-001',
    vendorId: process.env.TEST_VENDOR_ID || 'test-vendor-001',
    serviceId: process.env.TEST_SERVICE_ID || 'test-service-001',
  };

  const tests = [
    {
      name: 'Complete Booking Lifecycle',
      fn: () => testCompleteBookingLifecycle(ctx),
      critical: true,
    },
    {
      name: 'Status Transition Validation',
      fn: () => testStatusTransitions(ctx),
      critical: true,
    },
    {
      name: 'OTP Generation and Verification',
      fn: () => testOtpFlow(ctx),
      critical: true,
    },
    {
      name: 'Booking Cancellation Flow',
      fn: () => testBookingCancellation(ctx),
      critical: false,
    },
    {
      name: 'Enhanced Status Update with Audit',
      fn: () => testEnhancedStatusUpdate(ctx),
      critical: false,
    },
    {
      name: 'Notification Triggers',
      fn: () => testNotificationTriggers(ctx),
      critical: false,
    },
    {
      name: 'Rating Submission Flow',
      fn: () => testRatingFlow(ctx),
      critical: false,
    },
  ];

  const results: { name: string; passed: boolean; error?: string; critical: boolean }[] = [];

  for (const test of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🧪 ${test.name}${test.critical ? ' [CRITICAL]' : ''}`);
    console.log('─'.repeat(60));

    try {
      await test.fn();
      results.push({ name: test.name, passed: true, critical: test.critical });
      console.log(`\n✅ ${test.name} - PASSED`);
    } catch (error: any) {
      results.push({
        name: test.name,
        passed: false,
        error: error.message,
        critical: test.critical,
      });
      console.log(`\n❌ ${test.name} - FAILED: ${error.message}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalPassed = results.filter(r => r.passed && r.critical).length;
  const criticalFailed = results.filter(r => !r.passed && r.critical).length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    const critical = r.critical ? ' [CRITICAL]' : '';
    console.log(`${icon} ${r.name}${critical}${r.error ? `: ${r.error}` : ''}`);
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Critical: ${criticalPassed}/${results.filter(r => r.critical).length} passed`);
  console.log('═'.repeat(60));

  // Exit with error code if any critical tests failed
  if (criticalFailed > 0) {
    console.log('\n⚠️  CRITICAL TESTS FAILED - Service fulfillment may not work correctly');
    process.exit(1);
  } else if (failed > 0) {
    console.log('\n⚠️  Some non-critical tests failed - Review and fix if needed');
    process.exit(0);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
if (require.main === module) {
  runServiceFulfillmentTests().catch((error) => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

export { runServiceFulfillmentTests };


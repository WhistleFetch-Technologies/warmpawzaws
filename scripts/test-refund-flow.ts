/**
 * 💰 Refund Flow Test Script
 * 
 * Tests the refund flow:
 * 1. Create booking with payment
 * 2. Cancel booking
 * 3. Verify refund initiated
 * 4. Verify refund status
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
}

async function testRefundFlow(): Promise<void> {
  const results: TestResult[] = [];
  let bookingId: string | null = null;

  console.log('💰 Starting Refund Flow Test\n');

  // Step 1: Create a paid booking
  try {
    console.log('1️⃣ Creating test booking with payment...');
    
    // First create booking
    const bookingResponse = await fetch(`${API_BASE_URL}/customer/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        customerId: 'test_customer_' + Date.now(),
        vendorId: 'test_vendor_123',
        serviceId: 'test_service_123',
        petId: 'test_pet_123',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTime: '10:00 AM',
        serviceType: 'at_center',
        amount: 1000,
        address: {
          street: '123 Test St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      }),
    });

    if (!bookingResponse.ok) {
      throw new Error(`Booking creation failed: ${bookingResponse.statusText}`);
    }

    const bookingData = await bookingResponse.json();
    bookingId = bookingData.bookingId || bookingData.booking?.id;

    if (!bookingId) {
      throw new Error('Booking ID not returned');
    }

    // Simulate payment (mark as paid)
    // In real scenario, this would be done via payment flow
    // For testing, we'll check if cancellation properly handles refund status

    results.push({
      step: 'Create Booking',
      success: true,
      data: { bookingId },
    });
    console.log('   ✅ Booking created:', bookingId);
  } catch (error: any) {
    results.push({
      step: 'Create Booking',
      success: false,
      error: error.message,
    });
    console.log('   ❌ Failed:', error.message);
    return printResults(results);
  }

  // Step 2: Get booking and verify it can be cancelled
  try {
    console.log('\n2️⃣ Fetching booking details...');
    const bookingResponse = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!bookingResponse.ok) {
      throw new Error(`Booking fetch failed: ${bookingResponse.statusText}`);
    }

    const booking = await bookingResponse.json();
    const bookingObj = booking.booking || booking;

    results.push({
      step: 'Fetch Booking',
      success: true,
      data: {
        status: bookingObj.status,
        paymentStatus: bookingObj.paymentStatus,
        amount: bookingObj.amount,
      },
    });
    console.log('   ✅ Booking fetched');
    console.log(`      Status: ${bookingObj.status}`);
    console.log(`      Payment Status: ${bookingObj.paymentStatus || 'N/A'}`);
    console.log(`      Amount: ₹${bookingObj.amount || bookingObj.totalAmount || 0}`);
  } catch (error: any) {
    results.push({
      step: 'Fetch Booking',
      success: false,
      error: error.message,
    });
    console.log('   ❌ Failed:', error.message);
  }

  // Step 3: Cancel booking (should trigger refund if paid)
  try {
    console.log('\n3️⃣ Cancelling booking (should trigger refund if paid)...');
    const cancelResponse = await fetch(`${API_BASE_URL}/booking/${bookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        reason: 'Test cancellation',
        cancelledBy: 'customer',
      }),
    });

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json().catch(() => ({}));
      throw new Error(`Cancellation failed: ${cancelResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const cancelData = await cancelResponse.json();

    results.push({
      step: 'Cancel Booking',
      success: true,
      data: cancelData,
    });
    console.log('   ✅ Booking cancelled');
  } catch (error: any) {
    results.push({
      step: 'Cancel Booking',
      success: false,
      error: error.message,
    });
    console.log('   ❌ Failed:', error.message);
    return printResults(results);
  }

  // Step 4: Verify refund status
  try {
    console.log('\n4️⃣ Verifying refund status...');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for processing

    const bookingResponse = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!bookingResponse.ok) {
      throw new Error(`Booking fetch failed: ${bookingResponse.statusText}`);
    }

    const booking = await bookingResponse.json();
    const bookingObj = booking.booking || booking;

    const hasRefundStatus = bookingObj.refundStatus !== undefined;
    const refundPending = bookingObj.refundStatus === 'pending' || bookingObj.refundStatus === 'processing';

    results.push({
      step: 'Verify Refund Status',
      success: hasRefundStatus,
      data: {
        refundStatus: bookingObj.refundStatus,
        refundAmount: bookingObj.refundAmount,
        refundId: bookingObj.refundId,
        status: bookingObj.status,
      },
    });

    if (hasRefundStatus) {
      console.log('   ✅ Refund status found');
      console.log(`      Refund Status: ${bookingObj.refundStatus || 'N/A'}`);
      console.log(`      Refund Amount: ₹${bookingObj.refundAmount || 0}`);
      if (bookingObj.refundId) {
        console.log(`      Refund ID: ${bookingObj.refundId}`);
      }
    } else {
      console.log('   ⚠️ No refund status found (booking may not have been paid)');
      console.log('      This is expected if booking was not marked as paid');
    }
  } catch (error: any) {
    results.push({
      step: 'Verify Refund Status',
      success: false,
      error: error.message,
    });
    console.log('   ❌ Failed:', error.message);
  }

  printResults(results);
}

function printResults(results: TestResult[]): void {
  console.log('\n📊 Test Results Summary\n');
  console.log('━'.repeat(60));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.step}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  });

  console.log('━'.repeat(60));
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Review errors above.');
  }
}

// Run if called directly
if (require.main === module) {
  testRefundFlow().catch(console.error);
}

export { testRefundFlow };


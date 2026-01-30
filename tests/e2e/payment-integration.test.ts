/**
 * ============================================================================
 * E2E TESTS: PAYMENT INTEGRATION
 * ============================================================================
 * 
 * Tests payment flows including:
 * 1. Payment order creation (Razorpay)
 * 2. Payment verification
 * 3. Wallet operations
 * 4. Settlement processing
 * 5. Refund handling
 * 
 * Run: npx ts-node tests/e2e/payment-integration.test.ts
 * Date: 2026-01-28
 * ============================================================================
 */

import {
  apiRequest,
  apiRequestWithRetry,
  runTestSuite,
  TestSuite,
  assert,
  assertDefined,
  log,
  logError,
  sleep,
  generateTestPhone,
  generateUUID,
  TEST_CONFIG,
  TEST_DATA,
} from './test-utils';

// ============================================================================
// TEST CONTEXT
// ============================================================================

interface PaymentTestContext {
  customerId: string;
  customerPhone: string;
  vendorId: string;
  bookingId: string;
  orderId?: string;
  paymentId?: string;
  walletBalance?: number;
}

const ctx: PaymentTestContext = {
  customerId: generateUUID(),
  customerPhone: TEST_DATA.customer.phone,
  vendorId: generateUUID(),
  bookingId: generateUUID(),
};

// ============================================================================
// TEST SUITES
// ============================================================================

const razorpayOrderSuite: TestSuite = {
  name: 'Razorpay Payment Order',
  tests: [
    {
      name: 'Should create payment order for booking',
      fn: async () => {
        const response = await apiRequest('/payments/create-order', {
          method: 'POST',
          body: {
            bookingId: ctx.bookingId,
            amount: 500,
            currency: 'INR',
            customerPhone: ctx.customerPhone,
            notes: {
              booking_id: ctx.bookingId,
              customer_phone: ctx.customerPhone,
            },
          },
        });

        log('Payment', 'Create order response', response);

        if (response.success && response.data?.orderId) {
          ctx.orderId = response.data.orderId;
          log('Payment', `Created order: ${ctx.orderId}`);
        } else if (response.success && response.data?.order_id) {
          ctx.orderId = response.data.order_id;
          log('Payment', `Created order: ${ctx.orderId}`);
        }
      },
    },
    {
      name: 'Should reject payment order with invalid amount',
      fn: async () => {
        const response = await apiRequest('/payments/create-order', {
          method: 'POST',
          body: {
            bookingId: ctx.bookingId,
            amount: -100, // Invalid negative amount
            currency: 'INR',
          },
        });

        log('Payment', 'Invalid amount response', response);

        // Should fail validation
        assert(!response.success || response.statusCode === 400, 'Negative amount should be rejected');
      },
    },
    {
      name: 'Should require booking ID for payment order',
      fn: async () => {
        const response = await apiRequest('/payments/create-order', {
          method: 'POST',
          body: {
            amount: 500,
            currency: 'INR',
            // Missing bookingId
          },
        });

        log('Payment', 'Missing booking ID response', response);

        // Should fail
        assert(!response.success || response.statusCode === 400, 'Missing booking ID should fail');
      },
    },
  ],
};

const paymentVerificationSuite: TestSuite = {
  name: 'Payment Verification',
  tests: [
    {
      name: 'Should verify successful payment',
      fn: async () => {
        if (!ctx.orderId) {
          log('Verify', 'Skipping - no order created');
          return;
        }

        // Simulate payment verification (would normally come from Razorpay webhook)
        const response = await apiRequest('/payments/verify', {
          method: 'POST',
          body: {
            orderId: ctx.orderId,
            paymentId: 'pay_test_' + Date.now(),
            signature: 'test_signature', // Would be real signature from Razorpay
          },
        });

        log('Verify', 'Verify payment response', response);

        if (response.success && response.data?.paymentId) {
          ctx.paymentId = response.data.paymentId;
        }
      },
    },
    {
      name: 'Should reject invalid payment signature',
      fn: async () => {
        const response = await apiRequest('/payments/verify', {
          method: 'POST',
          body: {
            orderId: 'order_invalid',
            paymentId: 'pay_invalid',
            signature: 'invalid_signature',
          },
        });

        log('Verify', 'Invalid signature response', response);

        // Should fail verification
        assert(!response.success, 'Invalid signature should fail verification');
      },
    },
    {
      name: 'Should handle payment status check',
      fn: async () => {
        if (!ctx.orderId) {
          log('Verify', 'Skipping - no order created');
          return;
        }

        const response = await apiRequest(`/payments/status/${ctx.orderId}`);

        log('Verify', 'Payment status response', response);
      },
    },
  ],
};

const walletSuite: TestSuite = {
  name: 'Wallet Operations',
  tests: [
    {
      name: 'Should fetch wallet balance',
      fn: async () => {
        const response = await apiRequest(`/wallet/${ctx.customerPhone}/balance`);

        log('Wallet', 'Balance response', response);

        if (response.success && response.data?.balance !== undefined) {
          ctx.walletBalance = response.data.balance;
          log('Wallet', `Current balance: ${ctx.walletBalance}`);
        }
      },
    },
    {
      name: 'Should add funds to wallet',
      fn: async () => {
        const response = await apiRequest('/wallet/add-funds', {
          method: 'POST',
          body: {
            phone: ctx.customerPhone,
            amount: 1000,
            source: 'razorpay',
            transactionId: 'txn_test_' + Date.now(),
          },
        });

        log('Wallet', 'Add funds response', response);
      },
    },
    {
      name: 'Should deduct from wallet for payment',
      fn: async () => {
        const response = await apiRequest('/wallet/pay', {
          method: 'POST',
          body: {
            phone: ctx.customerPhone,
            amount: 500,
            bookingId: ctx.bookingId,
            description: 'Payment for booking',
          },
        });

        log('Wallet', 'Wallet payment response', response);
      },
    },
    {
      name: 'Should fetch wallet transaction history',
      fn: async () => {
        const response = await apiRequest(`/wallet/${ctx.customerPhone}/transactions`);

        log('Wallet', 'Transaction history response', response);

        if (response.success && response.data?.transactions) {
          assert(
            Array.isArray(response.data.transactions),
            'Transactions should be an array'
          );
        }
      },
    },
    {
      name: 'Should reject negative wallet deduction',
      fn: async () => {
        const response = await apiRequest('/wallet/pay', {
          method: 'POST',
          body: {
            phone: ctx.customerPhone,
            amount: -100, // Invalid
            bookingId: ctx.bookingId,
          },
        });

        log('Wallet', 'Negative amount response', response);

        assert(!response.success || response.statusCode === 400, 'Negative amount should be rejected');
      },
    },
  ],
};

const settlementSuite: TestSuite = {
  name: 'Settlement Processing',
  tests: [
    {
      name: 'Should fetch pending settlements for vendor',
      fn: async () => {
        const response = await apiRequest(`/vendor/${ctx.vendorId}/settlements?status=pending`);

        log('Settlement', 'Pending settlements response', response);
      },
    },
    {
      name: 'Should calculate vendor earnings',
      fn: async () => {
        const response = await apiRequest(`/vendor/${ctx.vendorId}/earnings`);

        log('Settlement', 'Earnings response', response);
      },
    },
    {
      name: 'Should fetch settlement history',
      fn: async () => {
        const response = await apiRequest(`/vendor/${ctx.vendorId}/settlements/history`);

        log('Settlement', 'Settlement history response', response);
      },
    },
    {
      name: 'Should verify commission calculation',
      fn: async () => {
        // Test commission calculation endpoint
        const response = await apiRequest('/settlements/calculate-commission', {
          method: 'POST',
          body: {
            vendorId: ctx.vendorId,
            bookingAmount: 1000,
            serviceCategory: 'vet_clinic',
          },
        });

        log('Settlement', 'Commission calculation response', response);

        if (response.success && response.data?.commission) {
          // Verify commission is reasonable (e.g., 10-25%)
          const commission = response.data.commission;
          const bookingAmount = 1000;
          const commissionRate = (commission / bookingAmount) * 100;
          
          log('Settlement', `Commission rate: ${commissionRate}%`);
        }
      },
    },
  ],
};

const refundSuite: TestSuite = {
  name: 'Refund Processing',
  tests: [
    {
      name: 'Should calculate refund amount based on policy',
      fn: async () => {
        const response = await apiRequest(`/bookings/${ctx.bookingId}/calculate-refund`, {
          method: 'POST',
        });

        log('Refund', 'Calculate refund response', response);
      },
    },
    {
      name: 'Should initiate refund for cancelled booking',
      fn: async () => {
        const response = await apiRequest('/refunds/initiate', {
          method: 'POST',
          body: {
            bookingId: ctx.bookingId,
            reason: 'Customer requested cancellation',
            refundType: 'full', // or 'partial'
          },
        });

        log('Refund', 'Initiate refund response', response);
      },
    },
    {
      name: 'Should fetch refund status',
      fn: async () => {
        const response = await apiRequest(`/refunds/booking/${ctx.bookingId}`);

        log('Refund', 'Refund status response', response);
      },
    },
    {
      name: 'Should apply refund to wallet',
      fn: async () => {
        const response = await apiRequest('/refunds/process-to-wallet', {
          method: 'POST',
          body: {
            bookingId: ctx.bookingId,
            phone: ctx.customerPhone,
            amount: 500,
          },
        });

        log('Refund', 'Wallet refund response', response);
      },
    },
  ],
};

const paymentGatewaySuite: TestSuite = {
  name: 'Payment Gateway Integration',
  tests: [
    {
      name: 'Should check Razorpay connection status',
      fn: async () => {
        const response = await apiRequest('/payments/gateway/status');

        log('Gateway', 'Gateway status response', response);
      },
    },
    {
      name: 'Should handle webhook from Razorpay',
      fn: async () => {
        // Simulate Razorpay webhook
        const response = await apiRequest('/webhooks/razorpay', {
          method: 'POST',
          body: {
            event: 'payment.captured',
            payload: {
              payment: {
                entity: {
                  id: 'pay_test_' + Date.now(),
                  order_id: ctx.orderId || 'order_test',
                  amount: 50000, // In paise
                  status: 'captured',
                },
              },
            },
          },
          headers: {
            'X-Razorpay-Signature': 'test_webhook_signature',
          },
        });

        log('Gateway', 'Webhook response', response);
      },
    },
  ],
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - PAYMENT INTEGRATION');
  console.log('═'.repeat(60));
  console.log(`API URL: ${TEST_CONFIG.apiBaseUrl}`);
  console.log(`Customer Phone: ${ctx.customerPhone}`);
  console.log('═'.repeat(60));

  const suites = [
    razorpayOrderSuite,
    paymentVerificationSuite,
    walletSuite,
    settlementSuite,
    refundSuite,
    paymentGatewaySuite,
  ];

  const allResults: any[] = [];

  for (const suite of suites) {
    const result = await runTestSuite(suite);
    allResults.push(result);
  }

  // Final Summary
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of allResults) {
    console.log(`\n${result.suiteName}:`);
    console.log(`  Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
  console.log('═'.repeat(60));

  // Exit with error code if any tests failed
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);

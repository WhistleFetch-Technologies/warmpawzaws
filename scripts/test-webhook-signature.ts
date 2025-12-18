/**
 * 🔐 Webhook Signature Verification Test
 * 
 * Tests Razorpay webhook signature verification
 */

import * as crypto from 'crypto';

interface WebhookTest {
  name: string;
  rawBody: string;
  signature: string;
  secret: string;
  expectedValid: boolean;
}

const tests: WebhookTest[] = [
  {
    name: 'Valid signature test',
    rawBody: JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test123',
            amount: 50000,
          },
        },
      },
    }),
    signature: '', // Will be calculated
    secret: 'test_webhook_secret_123',
    expectedValid: true,
  },
  {
    name: 'Invalid signature test',
    rawBody: JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test123',
            amount: 50000,
          },
        },
      },
    }),
    signature: 'invalid_signature',
    secret: 'test_webhook_secret_123',
    expectedValid: false,
  },
];

function calculateSignature(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expectedSignature = calculateSignature(rawBody, secret);
  return signature === expectedSignature;
}

async function testWebhookSignature(): Promise<void> {
  console.log('🔐 Testing Webhook Signature Verification\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`Test: ${test.name}`);

    // Calculate signature for valid test
    if (test.expectedValid && !test.signature) {
      test.signature = calculateSignature(test.rawBody, test.secret);
    }

    const isValid = verifySignature(test.rawBody, test.signature, test.secret);
    const testPassed = isValid === test.expectedValid;

    if (testPassed) {
      console.log('   ✅ PASSED');
      passed++;
    } else {
      console.log('   ❌ FAILED');
      console.log(`      Expected: ${test.expectedValid ? 'valid' : 'invalid'}, Got: ${isValid ? 'valid' : 'invalid'}`);
      failed++;
    }

    console.log(`      Signature: ${test.signature.substring(0, 20)}...`);
    console.log('');
  }

  console.log('━'.repeat(60));
  console.log(`\nResults: ${passed + failed} total | ${passed} passed | ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 All signature verification tests passed!');
  } else {
    console.log('⚠️ Some tests failed.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testWebhookSignature().catch(console.error);
}

export { testWebhookSignature, verifySignature, calculateSignature };


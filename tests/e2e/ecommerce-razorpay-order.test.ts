/**
 * E2E contract checks: POST /razorpay/create-order type ecommerce_order
 *
 * Run: npx ts-node tests/e2e/ecommerce-razorpay-order.test.ts
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const FAKE_UUID = '00000000-0000-0000-0000-000000000099';

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, data };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function main(): Promise<void> {
  console.log('E2E – ecommerce Razorpay create-order\n');

  const fakeEcommerce = await apiRequest('/razorpay/create-order', 'POST', {
    type: 'ecommerce_order',
    orderId: FAKE_UUID,
    amount: 100,
    customerId: FAKE_UUID,
  });
  assert(fakeEcommerce.status === 404, `fake ecommerce order → 404 (got ${fakeEcommerce.status})`);
  const fakeErr = String(fakeEcommerce.data?.error || fakeEcommerce.data?.message || '');
  assert(
    fakeErr.toLowerCase().includes('order not found'),
    `404 message mentions order not found (got "${fakeErr}")`
  );

  const wrongEntity = await apiRequest('/razorpay/create-order', 'POST', {
    bookingId: FAKE_UUID,
    amount: 100,
  });
  assert(wrongEntity.status === 404, `bookingId-only (shop uuid) → 404 Booking not found (got ${wrongEntity.status})`);
  const bookingErr = String(wrongEntity.data?.error || wrongEntity.data?.message || '');
  assert(
    bookingErr.toLowerCase().includes('booking not found'),
    `legacy bookingId path still returns Booking not found (got "${bookingErr}")`
  );

  const missingType = await apiRequest('/razorpay/create-order', 'POST', {
    orderId: FAKE_UUID,
    amount: 100,
    customerId: FAKE_UUID,
  });
  assert(
    [400, 404].includes(missingType.status),
    `orderId without type → 400 or 404, not mistaken for pharmacy (got ${missingType.status})`
  );

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

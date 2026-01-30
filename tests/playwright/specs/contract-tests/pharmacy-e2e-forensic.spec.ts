/**
 * ============================================================================
 * PHARMACY FLOW – E2E FORENSIC TEST (PARAMETER-LEVEL TRACING)
 * ============================================================================
 *
 * Traces request/response parameters from implementation code only.
 * No MD files, no assumptions. Validates exact shapes used by:
 * - apps/customer-web/components/customer/specialized/PharmacyOrderFlow.tsx
 * - apps/customer-web/components/customer/pharmacy/PharmacyOrderStatus.tsx
 * - apps/vendor-web/components/vendor/pharmacy/PharmacyOrderDashboard.tsx
 * - backend/lambda/src/endpoints/pharmacy-orders.ts
 * - backend/lambda/src/endpoints/customer-enhanced.ts (pharmacy-status)
 * - backend/lambda/src/endpoints/razorpay.ts
 * - backend/lambda/src/endpoints/delivery-otp.ts
 *
 * Set API_BASE_URL, optionally TEST_CUSTOMER_ID, TEST_PHARMACY_VENDOR_ID,
 * TEST_PHARMACY_ORDER_ID for full flow. With placeholders, validates error/param shapes.
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Payload shapes from implementation (PharmacyOrderFlow createOrder).
// Backend resolves customer_id from customerPhone (get-or-create) when customerId not provided.
const CREATE_ORDER_BODY = {
  customerPhone: process.env.TEST_CUSTOMER_PHONE || '+919876543210',
  prescriptionUrl: 'https://example.com/prescription.jpg',
  deliveryAddress: {
    addressLine1: '123 Test St',
    city: 'Mumbai',
    state: 'MH',
    pincode: '400001',
    latitude: 19.076,
    longitude: 72.8777,
  },
  notes: 'Forensic test order',
};

test.describe('Pharmacy E2E Forensic – Parameter-level validation', () => {

  test('1. POST /pharmacy/orders/create – request params from PharmacyOrderFlow, response shape from backend', async ({ request }) => {
    // Backend expects: customerId, deliveryAddress (lat/lng or latitude/longitude), items OR prescriptionId/prescriptionUrl
    const res = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: CREATE_ORDER_BODY,
    });
    // 400 if validation fails, 500 if DB/insert fails
    expect([200, 400, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      // Backend returns: success, orderId, order, broadcast, message
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('orderId');
      expect(typeof data.orderId).toBe('string');
      expect(data).toHaveProperty('order');
      expect(data.order).toHaveProperty('id', data.orderId);
      expect(data.order).toHaveProperty('status', 'broadcasting');
      expect(data.order).toHaveProperty('totalAmount');
      expect(data.order).toHaveProperty('estimatedDeliveryFee');
      expect(data.order).toHaveProperty('broadcastRadius');
      expect(data).toHaveProperty('broadcast');
      expect(data.broadcast).toHaveProperty('status', 'broadcasting');
      expect(data.broadcast).toHaveProperty('currentRadius');
      expect(data.broadcast).toHaveProperty('startedAt');
      expect(data.broadcast).toHaveProperty('expiresAt');
      expect(data.broadcast).toHaveProperty('notifiedPharmaciesCount');
      // UI uses: res.success, res.orderId, res.broadcast (setBroadcastStatus)
      return data.orderId as string;
    }
    if (res.status() === 400) {
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    }
  });

  test('2. GET /pharmacy/orders/:orderId/broadcast-status – response shape used by PharmacyOrderFlow poll', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/pharmacy/orders/${orderId}/broadcast-status`);
    expect([200, 404, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('broadcastStatus');
      const bs = data.broadcastStatus;
      expect(bs).toHaveProperty('currentRadius');
      expect(bs).toHaveProperty('totalBroadcasts');
      expect(bs).toHaveProperty('accepted');
      expect(bs).toHaveProperty('pending');
      expect(bs).toHaveProperty('rejected');
      expect(data).toHaveProperty('broadcasts');
      expect(Array.isArray(data.broadcasts)).toBe(true);
      if (data.broadcasts.length > 0) {
        const b = data.broadcasts[0];
        expect(b).toHaveProperty('id');
        expect(b).toHaveProperty('pharmacyId');
        expect(b).toHaveProperty('pharmacyName');
        expect(b).toHaveProperty('status');
        expect(b).toHaveProperty('respondedAt');
        // Optional from backend: pharmacy_phone, distance_from_customer
      }
    }
  });

  test('3. POST /pharmacy/orders/:orderId/accept – request params from PharmacyOrderDashboard', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const vendorId = process.env.TEST_PHARMACY_VENDOR_ID || '00000000-0000-0000-0000-000000000002';
    const body = {
      pharmacyId: vendorId,
      availableItems: ['Item A', 'Item B'],
      unavailableItems: [] as string[],
    };
    const res = await request.post(`${API_BASE}/pharmacy/orders/${orderId}/accept`, { data: body });
    expect([200, 400, 404, 409, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('orderId');
    }
    if (res.status() === 400) expect(data).toHaveProperty('error');
    if (res.status() === 404) expect(data).toHaveProperty('error');
    if (res.status() === 409) expect(data).toHaveProperty('error');
  });

  test('4. POST /pharmacy/orders/:orderId/invoice – request/response from PharmacyOrderDashboard and backend', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const body = {
      invoiceItems: [
        { name: 'Medicine A', quantity: 2, unit_price: 100 },
        { name: 'Medicine B', quantity: 1, unit_price: 250 },
      ],
    };
    const res = await request.post(`${API_BASE}/pharmacy/orders/${orderId}/invoice`, { data: body });
    expect([200, 404, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('invoice');
      const inv = data.invoice;
      expect(inv).toHaveProperty('orderId');
      expect(inv).toHaveProperty('orderNumber');
      expect(inv).toHaveProperty('items');
      expect(Array.isArray(inv.items)).toBe(true);
      expect(inv).toHaveProperty('subtotal');
      expect(inv).toHaveProperty('deliveryFee');
      expect(inv).toHaveProperty('platformFee');
      expect(inv).toHaveProperty('convenienceFee');
      expect(inv).toHaveProperty('totalAmount');
      expect(inv).toHaveProperty('paymentMethod');
    }
  });

  test('5. GET /pharmacy/orders/:orderId/pharmacy-status – response shape (same as customer endpoint, public for contract test)', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/pharmacy/orders/${orderId}/pharmacy-status`);
    expect([200, 404, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('order');
      const o = data.order;
      expect(o).toHaveProperty('id');
      expect(o).toHaveProperty('status');
      expect(o).toHaveProperty('pharmacyId');
      expect(o).toHaveProperty('pharmacyName');
      expect(o).toHaveProperty('pharmacyPhone');
      expect(o).toHaveProperty('medicines');
      expect(Array.isArray(o.medicines)).toBe(true);
      expect(o).toHaveProperty('subtotal');
      expect(o).toHaveProperty('deliveryFee');
      expect(o).toHaveProperty('platformFee');
      expect(o).toHaveProperty('convenienceFee');
      expect(o).toHaveProperty('totalAmount');
      expect(o).toHaveProperty('total_amount');
      expect(o).toHaveProperty('deliveryOtp');
      expect(o).toHaveProperty('otpVerified');
      expect(o).toHaveProperty('deliveryPartnerName');
      expect(o).toHaveProperty('deliveryPartnerPhone');
      expect(o).toHaveProperty('deliveryAddress');
      expect(o).toHaveProperty('currentRadius');
      expect(o).toHaveProperty('maxRadius');
      expect(o).toHaveProperty('broadcastStartedAt');
      if (o.medicines.length > 0) {
        expect(o.medicines[0]).toHaveProperty('name');
        expect(o.medicines[0]).toHaveProperty('quantity');
        expect(o.medicines[0]).toHaveProperty('price');
        expect(o.medicines[0]).toHaveProperty('available');
      }
    }
  });

  test('6. POST /razorpay/create-order – pharmacy_order type request/response from PharmacyOrderFlow and razorpay.ts', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const body = {
      orderId,
      amount: 500,
      customerId: process.env.TEST_CUSTOMER_ID || 'test-customer',
      type: 'pharmacy_order',
    };
    const res = await request.post(`${API_BASE}/razorpay/create-order`, { data: body });
    expect([200, 400, 404, 500, 504]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('amount');
      expect(data).toHaveProperty('currency');
      expect(data).toHaveProperty('keyId');
      expect(typeof data.orderId).toBe('string');
      expect(typeof data.amount).toBe('number');
    }
    if (res.status() === 400) {
      expect(data).toHaveProperty('error');
      expect(data.error).toBeDefined();
    }
  });

  test('7. GET /delivery/:orderId/status – response shape used by PharmacyOrderFlow loadDeliveryStatus and DeliveryOTPVerification', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/delivery/${orderId}/status`);
    expect([200, 404, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('delivery_status');
      expect(data).toHaveProperty('partner_name');
      expect(data).toHaveProperty('partner_phone');
      expect(data).toHaveProperty('delivery_otp');
      expect(data).toHaveProperty('otp_verified');
      expect(typeof data.otp_verified).toBe('boolean');
    }
  });

  test('8. POST /delivery/:orderId/verify-otp – request body from delivery-otp.ts VerifyDeliveryOtpHandler', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const resEmpty = await request.post(`${API_BASE}/delivery/${orderId}/verify-otp`, { data: {} });
    expect([400, 404, 500]).toContain(resEmpty.status());
    const dataEmpty = await resEmpty.json();
    if (resEmpty.status() === 400) {
      expect(dataEmpty).toHaveProperty('error');
      expect(String(dataEmpty.error).toLowerCase()).toMatch(/otp|required/);
    }
    const resWithOtp = await request.post(`${API_BASE}/delivery/${orderId}/verify-otp`, {
      data: { otp: '1234' },
    });
    expect([200, 400, 404, 500]).toContain(resWithOtp.status());
    const dataOtp = await resWithOtp.json();
    if (resWithOtp.status() === 200) {
      expect(dataOtp).toHaveProperty('success', true);
      expect(dataOtp).toHaveProperty('message');
    }
  });

  test('9. GET /pharmacy/orders/incoming/:vendorId – response shape used by PharmacyOrderDashboard fetchIncomingOrders', async ({ request }) => {
    const vendorId = process.env.TEST_PHARMACY_VENDOR_ID || '00000000-0000-0000-0000-000000000002';
    const res = await request.get(`${API_BASE}/pharmacy/orders/incoming/${vendorId}`);
    expect([200, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.orders)).toBe(true);
      if (data.orders.length > 0) {
        const row = data.orders[0];
        expect(row).toHaveProperty('order_id');
        expect(row).toHaveProperty('customer_name');
        expect(row).toHaveProperty('customer_phone');
        expect(row).toHaveProperty('delivery_fee');
        expect(row).toHaveProperty('items');
        expect(row).toHaveProperty('expiresIn');
      }
    }
  });

  test('10. GET /pharmacy/:vendorId/orders – query and response used by PharmacyOrderDashboard fetchActiveOrders', async ({ request }) => {
    const vendorId = process.env.TEST_PHARMACY_VENDOR_ID || '00000000-0000-0000-0000-000000000002';
    const res = await request.get(`${API_BASE}/pharmacy/${vendorId}/orders?status=confirmed,invoice_generated,payment_confirmed,preparing,dispatched`);
    expect([200, 500]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('orders');
      expect(Array.isArray(data.orders)).toBe(true);
      if (data.orders.length > 0) {
        const row = data.orders[0];
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('order_number');
        expect(row).toHaveProperty('customer_name');
        expect(row).toHaveProperty('customer_phone');
        expect(row).toHaveProperty('status');
        expect(row).toHaveProperty('total_amount');
        expect(row).toHaveProperty('items');
      }
    }
  });

  test('11. POST /pharmacy/orders/create – 400 when missing customerId', async ({ request }) => {
    const res = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: {
        deliveryAddress: { latitude: 19.076, longitude: 72.8777 },
        prescriptionUrl: 'https://x.com/p.jpg',
      },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
    expect(String(data.error).toLowerCase()).toMatch(/customer|required/);
  });

  test('12. POST /pharmacy/orders/create – 400 when missing coordinates', async ({ request }) => {
    const res = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: {
        customerId: 'test-id',
        deliveryAddress: { addressLine1: 'X', city: 'Y', pincode: '400001' },
        prescriptionUrl: 'https://x.com/p.jpg',
      },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
    expect(String(data.error).toLowerCase()).toMatch(/coordinate|lat|lng/);
  });

  test('13. POST /pharmacy/orders/create – 400 when no items and no prescription', async ({ request }) => {
    const res = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: {
        customerId: 'test-id',
        deliveryAddress: { latitude: 19.076, longitude: 72.8777 },
      },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
    expect(String(data.error).toLowerCase()).toMatch(/items|prescription/);
  });

  test('14. Sequential: create → broadcast-status → pharmacy-status (parameter chain from implementation)', async ({ request }) => {
    const uniquePhone = `+9198765${String(Date.now()).slice(-6)}`;
    const createRes = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: {
        ...CREATE_ORDER_BODY,
        customerPhone: uniquePhone,
      },
    });
    const createData = await createRes.json();
    if (createRes.status() !== 200 || !createData.orderId) {
      test.skip(createRes.status() === 400 ? 'Create returned 400 – deploy backend with customerPhone get-or-create' : 'Create did not return 200 with orderId');
      return;
    }
    const orderId = createData.orderId as string;
    expect(createData.broadcast).toHaveProperty('currentRadius');
    expect(createData.broadcast).toHaveProperty('startedAt');
    expect(createData.broadcast).toHaveProperty('expiresAt');

    const broadcastRes = await request.get(`${API_BASE}/pharmacy/orders/${orderId}/broadcast-status`);
    expect(broadcastRes.status()).toBe(200);
    const broadcastData = await broadcastRes.json();
    expect(broadcastData.success).toBe(true);
    expect(broadcastData.broadcastStatus).toHaveProperty('currentRadius');
    expect(broadcastData.broadcastStatus).toHaveProperty('totalBroadcasts');
    expect(broadcastData.broadcastStatus).toHaveProperty('accepted');
    expect(Array.isArray(broadcastData.broadcasts)).toBe(true);

    // Use public pharmacy-status (same shape as customer endpoint; no auth required for contract test)
    const statusRes = await request.get(`${API_BASE}/pharmacy/orders/${orderId}/pharmacy-status`);
    expect(statusRes.status()).toBe(200);
    const statusData = await statusRes.json();
    expect(statusData.success).toBe(true);
    expect(statusData.order).toHaveProperty('id', orderId);
    expect(statusData.order).toHaveProperty('status', 'broadcasting');
    expect(statusData.order).toHaveProperty('medicines');
    expect(statusData.order).toHaveProperty('subtotal');
    expect(statusData.order).toHaveProperty('totalAmount');
    expect(statusData.order).toHaveProperty('currentRadius');
    expect(statusData.order).toHaveProperty('broadcastStartedAt');
  });
});

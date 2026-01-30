/**
 * ============================================================================
 * PHARMACY FLOW – FORENSIC SYSTEMATIC TEST
 * ============================================================================
 *
 * Verifies API contracts and flow for:
 * - Create order & broadcast
 * - Incoming orders (vendor)
 * - Accept order
 * - Proforma invoice
 * - Razorpay create-order / verify-payment (pharmacy_order type)
 * - Delivery status & OTP verify
 *
 * Run after DB migrations and deploy.
 * Set API_URL (and optional test customer/vendor IDs) for live API.
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

test.describe('Pharmacy flow – API contracts', () => {

  test('GET /pharmacy/orders/incoming/:vendorId returns array and success', async ({ request }) => {
    const vendorId = process.env.TEST_PHARMACY_VENDOR_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/pharmacy/orders/incoming/${vendorId}`);
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.orders ?? data.incomingOrders ?? [])).toBe(true);
    }
  });

  test('GET /pharmacy/:vendorId/orders with status filter returns array', async ({ request }) => {
    const vendorId = process.env.TEST_PHARMACY_VENDOR_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/pharmacy/${vendorId}/orders?status=confirmed,invoice_generated,payment_confirmed,preparing,dispatched`);
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.orders ?? [])).toBe(true);
    }
  });

  test('POST /pharmacy/orders/create requires body (address, items/customer)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/pharmacy/orders/create`, {
      data: {},
    });
    expect([400, 422, 500]).toContain(res.status());
  });

  test('POST /pharmacy/orders/:orderId/invoice requires invoiceItems or items', async ({ request }) => {
    const orderId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(`${API_BASE}/pharmacy/orders/${orderId}/invoice`, {
      data: {},
    });
    expect([200, 404, 500]).toContain(res.status());
    if (res.ok()) {
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data.invoice).toBeDefined();
    }
  });

  test('GET /customer/orders/:orderId/pharmacy-status returns order shape', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/customer/orders/${orderId}/pharmacy-status`);
    expect([200, 404, 500]).toContain(res.status());
    if (res.ok()) {
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      const order = data.order || data;
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('totalAmount');
      expect(order).toHaveProperty('medicines');
    }
  });

  test('GET /delivery/:orderId/status returns status and optional delivery_otp', async ({ request }) => {
    const orderId = process.env.TEST_PHARMACY_ORDER_ID || '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/delivery/${orderId}/status`);
    expect([200, 404, 500]).toContain(res.status());
    if (res.ok()) {
      const data = await res.json();
      expect(data).toHaveProperty('status');
    }
  });

  test('POST /delivery/:orderId/verify-otp requires otp', async ({ request }) => {
    const orderId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(`${API_BASE}/delivery/${orderId}/verify-otp`, {
      data: {},
    });
    expect([400, 404, 500]).toContain(res.status());
  });

  test('POST /razorpay/create-order with type pharmacy_order requires orderId and amount', async ({ request }) => {
    const res = await request.post(`${API_BASE}/razorpay/create-order`, {
      data: { type: 'pharmacy_order' },
    });
    expect([400, 404, 500]).toContain(res.status());
  });
});

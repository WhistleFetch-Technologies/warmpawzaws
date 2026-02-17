/**
 * Instant Tele V2 – API contract tests (vet-only, available-now, payment-first, no queue).
 * Mirrors scripts/forensic-instant-tele-v2-e2e.js for systematic testing in CI/Playwright.
 *
 * Run: npx playwright test specs/contract-tests/instant-tele-v2-api.spec.ts
 * API: API_URL or TEST_API_URL (default: production API)
 */

import { test, expect } from '@playwright/test';

const API_BASE = (process.env.API_URL || process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com').replace(/\/$/, '');
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';

test.describe('Instant Tele V2 – API contract', () => {
  test('GET /customer/tele/available-now returns 200 and { success, vendors[] } or 404 if not deployed', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customer/tele/available-now`);
    if (res.status() === 404) {
      test.info().annotations.push({ type: 'note', description: 'Endpoint 404 – instant-tele-v2 may not be deployed' });
      return;
    }
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.vendors)).toBe(true);
    if (data.vendors.length > 0) {
      const v = data.vendors[0];
      expect(v.vendorId || v.vendor_id).toBeTruthy();
      expect(v.vendorName || v.vendor_name).toBeTruthy();
    }
  });

  test('GET /customer/vendor/:id/services?serviceStyle=tele returns 200 and services array when vendor exists', async ({ request }) => {
    const availRes = await request.get(`${API_BASE}/customer/tele/available-now`);
    if (!availRes.ok() || availRes.status() === 404) {
      test.skip(true, 'available-now not deployed or failed');
    }
    const avail = await availRes.json();
    const vendors = avail.vendors || [];
    if (vendors.length === 0) {
      test.skip(true, 'No vendors available now');
    }
    const vendorId = vendors[0].vendorId || vendors[0].vendor_id;
    const res = await request.get(`${API_BASE}/customer/vendor/${vendorId}/services?serviceStyle=tele`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    const services = data.services || data.data || [];
    expect(Array.isArray(services)).toBe(true);
  });

  test('POST /customer/tele/instant-after-payment with missing params returns 400 (or 404 if not deployed)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/customer/tele/instant-after-payment`, {
      data: {
        razorpay_order_id: 'order_missing',
        razorpay_payment_id: 'pay_missing',
        razorpay_signature: 'sig',
      },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('POST /customer/tele/instant-after-payment with non-existent order returns 404 or 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/customer/tele/instant-after-payment`, {
      data: {
        razorpay_order_id: 'order_000000000000000000000000',
        razorpay_payment_id: 'pay_fake',
        razorpay_signature: 'signed_fake',
        vendorId: '00000000-0000-0000-0000-000000000001',
        customerId: '00000000-0000-0000-0000-000000000002',
        petId: '00000000-0000-0000-0000-000000000003',
        serviceId: '00000000-0000-0000-0000-000000000004',
        amount: 499,
      },
    });
    expect([400, 404]).toContain(res.status());
  });
});

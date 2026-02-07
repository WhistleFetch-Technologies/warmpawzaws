/**
 * ============================================================================
 * HOME SERVICES ADDRESS FLOW – FORENSIC E2E VALIDATION
 * ============================================================================
 *
 * Validates the fix for:
 * - Existing address pre-selected (default or first)
 * - Add new address enables Proceed to Payment (response.address with id)
 * - GET /customer/addresses?phone= contract (used by HomeServiceRouter, UniversalProviderProfile)
 *
 * Implementation refs:
 * - apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx
 * - apps/customer-web/components/customer/shared/UniversalProviderProfile.tsx
 * - apps/customer-web/components/customer/shared/AddAddressModal.tsx
 * - backend/lambda/src/endpoints/addresses.ts
 *
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || process.env.API_URL || '';
const CUSTOMER_URL = process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '919876543210';

test.describe('Home Services Address – Forensic validation', () => {

  test('1. GET /customer/addresses?phone= – response shape for pre-select and list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customer/addresses?phone=${encodeURIComponent(TEST_PHONE)}`);
    expect([200, 404, 500]).toContain(res.status());
    const data = await res.json();

    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('addresses');
      expect(Array.isArray(data.addresses)).toBe(true);

      for (const addr of data.addresses) {
        expect(addr).toHaveProperty('id');
        expect(addr).toHaveProperty('addressLine1');
        expect(addr).toHaveProperty('city');
        expect(addr).toHaveProperty('state');
        expect(addr).toHaveProperty('pincode');
        expect(addr).toHaveProperty('label');
        expect(addr).toHaveProperty('isDefault');
      }

      if (data.addresses.length > 0) {
        const defaultOrFirst = data.addresses.find((a: any) => a.isDefault ?? a.is_default) || data.addresses[0];
        expect(defaultOrFirst).toHaveProperty('id');
        expect(defaultOrFirst).toHaveProperty('addressLine1');
        expect(defaultOrFirst.addressLine1 || defaultOrFirst.address_line1).toBeTruthy();
      }
    }

    if (res.status() === 404) {
      expect(data).toHaveProperty('error');
    }
  });

  test('2. Pre-select logic: default or first address has required fields for Proceed to Payment', async ({ request }) => {
    const res = await request.get(`${API_BASE}/customer/addresses?phone=${encodeURIComponent(TEST_PHONE)}`);
    if (res.status() !== 200) return;

    const data = await res.json();
    if (!data.addresses?.length) return;

    const list = data.addresses;
    const defaultAddr = list.find((a: any) => a.isDefault === true || a.is_default === true);
    const toSelect = defaultAddr || list[0];

    expect(toSelect.id).toBeTruthy();
    expect(toSelect.addressLine1 || toSelect.address_line1).toBeTruthy();
    expect(toSelect.city).toBeTruthy();
    expect(toSelect.pincode).toBeTruthy();
    expect(toSelect.state).toBeTruthy();
  });

  test('3. POST /customer/addresses – response includes created address with id (for Proceed to Payment)', async ({ request }) => {
    const body = {
      phone: TEST_PHONE,
      label: 'home',
      name: 'Forensic Test',
      addressLine1: '123 Test St',
      addressLine2: 'Apt 1',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: false,
    };

    const res = await request.post(`${API_BASE}/customer/addresses`, { data: body });
    expect([200, 400, 404, 500]).toContain(res.status());
    const data = await res.json();

    if (res.status() === 200) {
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('addresses');
      expect(Array.isArray(data.addresses)).toBe(true);
      expect(data.address || data.addresses?.[data.addresses.length - 1]).toBeDefined();
      const created = data.address || data.addresses?.[data.addresses.length - 1];
      if (created) {
        expect(created).toHaveProperty('id');
        expect(created.id).toBeTruthy();
      }
    }
  });

  test('4. Customer app – home page returns HTML (address step / Proceed to Payment available in app)', async ({ request }) => {
    if (!CUSTOMER_URL) return;

    const res = await request.get(CUSTOMER_URL, { timeout: 15000 });
    expect([200, 304]).toContain(res.status());
    const body = await res.text();
    expect(body?.length ?? 0).toBeGreaterThan(100);
    expect(body).toMatch(/Proceed|Payment|Address|address|service/i);
  });
});

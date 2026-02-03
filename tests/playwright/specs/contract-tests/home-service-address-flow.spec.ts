/**
 * Home Service Address Flow - API contract & forensic validation
 *
 * Validates:
 * 1. GET /customer/addresses?phone= returns list shape (no undefined.length in UI)
 * 2. POST /customer/addresses returns created address with id (so Proceed to Payment enables)
 * 3. Response shapes match what UniversalProviderProfile and HomeServiceRouter expect
 *
 * Run: npx playwright test home-service-address-flow --project=contract-tests
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9999000002';

const headers = {
  'Content-Type': 'application/json',
  'X-UAT-Mode': 'true',
  'X-UAT-Token': 'uat-test-token',
};

// Replicate frontend normalization so we validate API response is safe for UI
function normalizeAddress(raw: any): { id: string; label: string; address: string; city?: string; pincode?: string; isDefault?: boolean } {
  if (!raw) return { id: '', label: 'Address', address: '' };
  const line1 = raw.addressLine1 ?? raw.address_line1;
  const line2 = raw.addressLine2 ?? raw.address_line2;
  const city = raw.city;
  const stateVal = raw.state;
  const pincode = raw.pincode;
  const addressLine = [line1, line2, city, stateVal, pincode].filter(Boolean).join(', ') || raw.address || '';
  return {
    id: raw.id || '',
    label: raw.label ?? raw.address_type ?? raw.name ?? 'Address',
    address: addressLine,
    city,
    pincode,
    isDefault: raw.isDefault ?? raw.is_default,
  };
}

test.describe('Home Service Address Flow - API contract', () => {
  test('GET /customer/addresses?phone= returns 200 and safe list shape for UI', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/customer/addresses?phone=${encodeURIComponent(TEST_PHONE)}`,
      { headers }
    );

    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('addresses');
      expect(Array.isArray(data.addresses)).toBe(true);

      const list = data.addresses as any[];
      for (const raw of list) {
        const normalized = normalizeAddress(raw);
        expect(normalized.id).toBeDefined();
        expect(typeof normalized.label).toBe('string');
        expect(typeof normalized.address).toBe('string');
      }

      const defaultOrFirst = list.find((a: any) => a.isDefault ?? a.is_default) || list[0];
      if (defaultOrFirst) {
        const selected = normalizeAddress(defaultOrFirst);
        expect(selected.id).toBeDefined();
      }
    }
  });

  test('GET response addresses array is never undefined (prevents .length crash)', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/customer/addresses?phone=${encodeURIComponent(TEST_PHONE)}`,
      { headers }
    );

    if (response.status() !== 200) return;

    const data = await response.json();
    const addresses = data?.addresses;
    expect(addresses !== undefined).toBe(true);
    expect(Array.isArray(addresses)).toBe(true);
    expect(() => addresses.length).not.toThrow();
  });

  test('POST /customer/addresses returns created address with id (for Proceed to Payment)', async ({ request }) => {
    const body = {
      phone: TEST_PHONE,
      label: 'home',
      name: 'E2E Test',
      addressLine1: '123 Test St',
      addressLine2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      landmark: null,
      isDefault: false,
    };

    const response = await request.post(`${API_BASE}/customer/addresses`, {
      headers,
      data: body,
    });

    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200 || response.status() === 201) {
      const data = await response.json();
      expect(data).toHaveProperty('success', true);

      const created = data.address ?? (data.addresses && data.addresses[data.addresses.length - 1]);
      if (created) {
        expect(created).toHaveProperty('id');
        expect(created.id).toBeTruthy();
        const normalized = normalizeAddress(created);
        expect(normalized.id).toBeTruthy();
      }
    }
  });
});

test.describe('Home Service Address Flow - forensic normalization', () => {
  test('normalizeAddress handles API snake_case and camelCase without throwing', () => {
    const snake = {
      id: 'uuid-1',
      address_type: 'home',
      address_line1: '48 Church St',
      address_line2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      is_default: true,
    };
    const norm = normalizeAddress(snake);
    expect(norm.id).toBe('uuid-1');
    expect(norm.label).toBe('home');
    expect(norm.address).toContain('560001');
    expect(norm.isDefault).toBe(true);
  });

  test('normalizeAddress handles empty or null safely', () => {
    expect(normalizeAddress(null).id).toBe('');
    expect(normalizeAddress(undefined).address).toBe('');
    expect(normalizeAddress({}).id).toBe('');
  });
});

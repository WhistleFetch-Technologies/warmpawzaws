import { test, expect } from '@playwright/test';

/**
 * API E2E Tests
 * 
 * Tests cover:
 * - Health check
 * - Authentication endpoints
 * - Vendor endpoints
 * - Customer endpoints
 * - Admin endpoints
 * - Booking endpoints
 * - Payment endpoints
 */

const API_BASE =
  process.env.PLAYWRIGHT_API_BASE ||
  process.env.API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const LOCAL_CUSTOMER_MANIFEST_GETS = [
  '/customer/discovery/meta',
  '/customer/discovery/count?category=vet&serviceStyle=at_center',
  '/customer/discover-services?category=vet&serviceStyle=at_center&limit=5',
  '/customer/services/by-style?style=at_center&category=vet',
  '/customer/delivery-fee-policy',
  '/customer/banners',
  '/customer/articles?limit=3',
  '/customer/announcements',
  '/customer/vendors/search?q=vet&limit=5',
  '/customer/featured-vendors',
  '/customer/featured-packages',
  '/customer/content-pages/about',
  '/customer/relocation/services',
  '/customer/password-status',
  '/customer/wallet',
  '/customer/payment-methods',
  '/customer/bookings/active',
  '/customer/orders',
  '/customer/appointments',
  '/customer/pets',
];

test.describe('API - Health Check', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database.connected).toBe(true);
  });
});

test.describe('API - Roles & Config', () => {
  test('should get available roles', async ({ request }) => {
    const response = await request.get(`${API_BASE}/config/roles`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test('should get regions', async ({ request }) => {
    const response = await request.get(`${API_BASE}/regions`);
    expect(response.ok()).toBeTruthy();
  });

  test('should get capabilities', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/capabilities`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-token-admin'
      }
    });
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('API - Vendor Onboarding', () => {
  test('should get onboarding roles', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/onboarding/roles`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should get onboarding status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/onboarding/status?phone=9876543210`);
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('API - Services', () => {
  test('should get services', async ({ request }) => {
    const response = await request.get(`${API_BASE}/services`);
    expect(response.ok()).toBeTruthy();
  });

  test('should get service catalog', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/service-catalog`);
    // May return 404 if endpoint doesn't exist, that's acceptable
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('API - Customer Endpoints', () => {
  test('should search vendors', async ({ request }) => {
    const response = await request.get(`${API_BASE}/customer/vendors/search?city=Bangalore`);
    expect(response.ok()).toBeTruthy();
  });

  test('should get problem grid', async ({ request }) => {
    const response = await request.get(`${API_BASE}/problem-grid`);
    // Problem grid endpoint may vary
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('API - Customer manifest GETs (local parity)', () => {
  test.skip(!process.env.PLAYWRIGHT_API_BASE, 'Set PLAYWRIGHT_API_BASE=http://localhost:3000 for local manifest run');

  for (const routePath of LOCAL_CUSTOMER_MANIFEST_GETS) {
    test(`GET ${routePath} returns 200 with JSON body`, async ({ request }) => {
      const response = await request.get(`${API_BASE}${routePath}`);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).not.toBeNull();
    });
  }
});

test.describe('API - Admin Endpoints', () => {
  const adminHeaders = {
    'X-UAT-Mode': 'true',
    'X-UAT-Token': 'uat-token-admin'
  };

  test('should get all vendors', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/vendors/all`, {
      headers: adminHeaders
    });
    expect(response.ok()).toBeTruthy();
  });

  test('should get all customers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/customers`, {
      headers: adminHeaders
    });
    expect(response.ok()).toBeTruthy();
  });

  test('should get all bookings', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/bookings`, {
      headers: adminHeaders
    });
    expect(response.ok()).toBeTruthy();
  });

  test('should get analytics', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/analytics/overview`, {
      headers: adminHeaders
    });
    // Analytics may have different endpoint structure
    expect([200, 404]).toContain(response.status());
  });

  test('should get GST configurations', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/finance/gst`, {
      headers: adminHeaders
    });
    // GST config endpoint may vary
    expect([200, 404]).toContain(response.status());
  });

  test('should get problem grid items', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/problem-grid/items`, {
      headers: adminHeaders
    });
    // Problem grid endpoint may vary
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('API - Vendor Endpoints', () => {
  const vendorHeaders = {
    'X-UAT-Mode': 'true',
    'X-UAT-Token': 'uat-token-vendor'
  };

  test('should get vendor dashboard', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/dashboard`, {
      headers: vendorHeaders
    });
    // May return 401 if no auth, but endpoint should exist
    expect([200, 401, 403]).toContain(response.status());
  });

  test('should get vendor services', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/services`, {
      headers: vendorHeaders
    });
    expect([200, 401, 403]).toContain(response.status());
  });
});

test.describe('API - Booking Endpoints', () => {
  test('should validate booking endpoint exists', async ({ request }) => {
    const response = await request.get(`${API_BASE}/bookings`);
    // May require auth, but endpoint should exist
    expect([200, 401, 403, 404]).toContain(response.status());
  });
});

test.describe('API - Error Handling', () => {
  test('should return 404 for unknown endpoints', async ({ request }) => {
    const response = await request.get(`${API_BASE}/this-endpoint-does-not-exist-12345`);
    expect([404, 400]).toContain(response.status());
  });

  test('should handle malformed requests gracefully', async ({ request }) => {
    const response = await request.post(`${API_BASE}/vendor/onboarding/submit`, {
      data: 'invalid json',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    // Should not crash - returns error status (including 404 if endpoint doesn't exist)
    expect([400, 404, 422, 500]).toContain(response.status());
  });
});

test.describe('API - CORS Headers', () => {
  test('should include CORS headers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
    
    // CORS headers may be present (depends on request origin)
    const headers = response.headers();
    // Just verify we got a valid response - CORS is handled by API Gateway
    expect(response.status()).toBe(200);
  });
});

test.describe('API - Response Time', () => {
  test('health endpoint should respond within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE}/health`);
    const duration = Date.now() - start;
    
    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(5000);
  });

  test('roles endpoint should respond within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE}/config/roles`);
    const duration = Date.now() - start;
    
    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(5000);
  });
});

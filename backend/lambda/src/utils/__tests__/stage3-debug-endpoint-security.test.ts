/**
 * Stage 3 — debug endpoint authorization + response data minimization.
 */
import type { Context } from 'hono';
import { Hono } from 'hono';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(async (sql: string) => {
    if (/COUNT\(DISTINCT va\.vendor_id\)/i.test(sql) || /COUNT\(\*\)::text AS c/i.test(sql) || /COUNT\(DISTINCT v\.id\)/i.test(sql)) {
      return { rows: [{ c: '3' }], rowCount: 1 };
    }
    if (/SELECT DISTINCT v\.id/i.test(sql)) {
      return {
        rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
        rowCount: 1,
      };
    }
    return { rows: [{ c: '0' }], rowCount: 1 };
  }),
}));

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

import { registerDebugAtCenterVendorsRoute } from '../../endpoints/customer/discovery/routes/debug-at-center-vendors.route';
import { executePharmacyNearbyPharmaciesDebug } from '../../endpoints/pharmacy-debug-nearby';
import { isAdminRole } from '../security-ownership';

function withRole(role?: string): Context {
  const store: Record<string, unknown> = {};
  if (role) {
    store.userRole = role;
    store.userGroups = [role];
  }
  return {
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
  } as unknown as Context;
}

function roleApp(register: (app: Hono) => void) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    const role = c.req.header('x-test-role');
    if (role) {
      (c as any).set('userRole', role);
      (c as any).set('userGroups', [role]);
    }
    await next();
  });
  register(app);
  return app;
}

describe('Stage 3 /customer/debug/at-center-vendors', () => {
  function buildApp() {
    return roleApp(registerDebugAtCenterVendorsRoute);
  }

  it('denies missing role (route-level; production missing Bearer is 401 via requireAuth)', async () => {
    const res = await buildApp().request('http://localhost/customer/debug/at-center-vendors');
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.all_vendors).toBeUndefined();
    expect(body.vet_vendors).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/business_name|latitude|longitude/i);
  });

  it('denies customer', async () => {
    const res = await buildApp().request('http://localhost/customer/debug/at-center-vendors', {
      headers: { 'x-test-role': 'customer' },
    });
    expect(res.status).toBe(403);
  });

  it('denies vendor', async () => {
    const res = await buildApp().request('http://localhost/customer/debug/at-center-vendors', {
      headers: { 'x-test-role': 'vendor' },
    });
    expect(res.status).toBe(403);
  });

  it('allows admin summary without vendor records', async () => {
    const res = await buildApp().request('http://localhost/customer/debug/at-center-vendors', {
      headers: { 'x-test-role': 'admin' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.summary).toEqual(
      expect.objectContaining({
        all_vendors_with_at_center: expect.any(Number),
        approved_active_non_solo: expect.any(Number),
        vet_category: expect.any(Number),
        vet_with_availability: expect.any(Number),
      }),
    );
    expect(body.all_vendors).toBeUndefined();
    expect(body.approved_vendors).toBeUndefined();
    expect(body.vet_vendors).toBeUndefined();
    expect(body.vet_availability).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/business_name|latitude|longitude|password|stack/i);
  });
});

describe('Stage 3 /pharmacy/debug/nearby-pharmacies', () => {
  function buildApp() {
    return roleApp((app) => {
      app.get('/pharmacy/debug/nearby-pharmacies', executePharmacyNearbyPharmaciesDebug);
    });
  }

  it('denies missing role', async () => {
    const res = await buildApp().request('http://localhost/pharmacy/debug/nearby-pharmacies');
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.debug?.allVendorsWithCoordinates).toBeUndefined();
    expect(body.debug?.pharmacyVendors).toBeUndefined();
  });

  it('denies customer and vendor', async () => {
    for (const role of ['customer', 'vendor']) {
      const res = await buildApp().request('http://localhost/pharmacy/debug/nearby-pharmacies', {
        headers: { 'x-test-role': role },
      });
      expect(res.status).toBe(403);
    }
  });

  it('allows admin counts without coordinates or vendor rows', async () => {
    const res = await buildApp().request(
      'http://localhost/pharmacy/debug/nearby-pharmacies?lat=19.1&lng=72.8&radius=5',
      { headers: { 'x-test-role': 'admin' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.debug.counts.vendorsWithCoordinates).toBeDefined();
    expect(body.debug.counts.approvedPharmaciesWithCoordinates).toBeDefined();
    expect(body.debug.allVendorsWithCoordinates).toBeUndefined();
    expect(body.debug.pharmacyVendors).toBeUndefined();
    expect(body.debug.boundingBox).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/business_name|SELECT \*|password|stack/i);
    // coordinates must not appear as vendor payload fields (searchLocation is caller-supplied)
    expect(body.debug.searchLocation).toEqual({ lat: 19.1, lng: 72.8 });
  });
});

describe('Stage 3 source contracts', () => {
  const fs = require('fs');
  const path = require('path');

  it('pharmacy-debug-nearby is admin-gated and count-only', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../endpoints/pharmacy-debug-nearby.ts'),
      'utf8',
    );
    expect(src).toMatch(/isAdminRole/);
    expect(src).toMatch(/COUNT\(\*\)::text AS c/);
    expect(src).not.toMatch(/allVendorsWithCoordinates/);
    expect(src).not.toMatch(/SELECT\s+v\.id,\s*v\.business_name,\s*v\.latitude/i);
    expect(src).not.toMatch(/business_name/);
  });

  it('at-center service does not return vendor row arrays', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '../../endpoints/customer/discovery/services/debug-at-center-vendors.service.ts',
      ),
      'utf8',
    );
    expect(src).toMatch(/isAdminRole/);
    expect(src).not.toMatch(/all_vendors:\s*allVendors/);
    expect(src).not.toMatch(/vet_vendors:\s*vetVendors/);
  });

  it('both pharmacy-orders registrations wire shared debug handler', () => {
    const a = fs.readFileSync(path.join(__dirname, '../../endpoints/pharmacy-orders.ts'), 'utf8');
    const b = fs.readFileSync(
      path.join(__dirname, '../../endpoints/orders/endpoint/pharmacy-orders.ts'),
      'utf8',
    );
    expect(a).toMatch(/executePharmacyNearbyPharmaciesDebug/);
    expect(b).toMatch(/executePharmacyNearbyPharmaciesDebug/);
    expect(a).not.toMatch(/allVendorsWithCoordinates/);
    expect(b).not.toMatch(/allVendorsWithCoordinates/);
  });
});

describe('isAdminRole for Stage 3 debug gates', () => {
  it('only admin is allowed', () => {
    expect(isAdminRole(withRole('admin'))).toBe(true);
    expect(isAdminRole(withRole('customer'))).toBe(false);
    expect(isAdminRole(withRole('vendor'))).toBe(false);
    expect(isAdminRole(withRole(undefined as any))).toBe(false);
  });
});

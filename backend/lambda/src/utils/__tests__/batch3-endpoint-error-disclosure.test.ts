/**
 * Batch 3 — endpoint-local error disclosure (F09 Logistics, F10 Customer Enhanced,
 * Vendor Dashboard Enhanced).
 */
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  deleteRows: jest.fn(),
  upsert: jest.fn(),
}));

jest.mock('../vendor-resolve', () => ({
  resolveVendorId: jest.fn(async (id: string) => id),
  resolveVendorIdsForLedger: jest.fn(async (id: string) => [id]),
}));

jest.mock('../aws/secrets-manager', () => ({
  getSecret: jest.fn(),
  getSecretJson: jest.fn(async () => ({})),
  putSecret: jest.fn(),
}));

jest.mock('../../lib/services/pidge-logistics', () => ({
  getPidgeOrderDefaults: jest.fn(async () => ({})),
  buildPidgeOrderPayloadFromSimplified: jest.fn(() => ({})),
  isPidgeNativeCreateOrderBody: jest.fn(() => true),
  pidgeCreateOrder: jest.fn(),
  pidgeGetOrderStatus: jest.fn(),
  pidgeCancelOrder: jest.fn(),
  extractPidgeOrderIdMap: jest.fn(() => ({})),
}));

jest.mock('../security-ownership', () => ({
  requireCustomerPhoneMatch: jest.fn(async () => ({
    ok: true,
    customerId: '11111111-1111-4111-8111-111111111111',
  })),
  requirePetOwnedByAuthCustomer: jest.fn(async () => ({ ok: true })),
  requirePathVendorMatchesAuth: jest.fn(async () => ({ ok: true, vendorId: 'v' })),
  isAdminRole: jest.fn(() => false),
}));

jest.mock('../customer-phone-lookup', () => ({
  findCustomerByPhone: jest.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
    phone: '9999999999',
    preferences: {},
  })),
}));

jest.mock('../../endpoints/customer/enhanced/repos/customer_phone_preferences_get.repo', () => ({
  dbCustomerPhonePreferencesGet1: jest.fn(),
}));

jest.mock('../../endpoints/customer/enhanced/repos/customer_phone_subscriptions_active_get.repo', () => ({
  dbCustomerPhoneSubscriptionsActiveGet0: jest.fn(),
  dbCustomerPhoneSubscriptionsActiveGet1: jest.fn(),
}));

import { query, select, insert } from '../../database/rds-connection';
import { pidgeCreateOrder } from '../../lib/services/pidge-logistics';
import { registerLogisticsEndpoints } from '../../endpoints/logistics';
import { registerVendorDashboardEnhancedEndpoints } from '../../endpoints/vendor/endpoints/vendor-dashboard-enhanced';
import { executecustomerPhonePreferencesGet } from '../../endpoints/customer/enhanced/services/customer_phone_preferences_get.service';
import { executecustomerPhoneSubscriptionsActiveGet } from '../../endpoints/customer/enhanced/services/customer_phone_subscriptions_active_get.service';
import { dbCustomerPhonePreferencesGet1 } from '../../endpoints/customer/enhanced/repos/customer_phone_preferences_get.repo';
import { requireCustomerPhoneMatch } from '../security-ownership';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;
const mockedInsert = insert as jest.MockedFunction<typeof insert>;
const mockedPidgeCreate = pidgeCreateOrder as jest.MockedFunction<typeof pidgeCreateOrder>;
const mockedPrefsRepo = dbCustomerPhonePreferencesGet1 as jest.MockedFunction<
  typeof dbCustomerPhonePreferencesGet1
>;
const mockedPhoneAuth = requireCustomerPhoneMatch as jest.MockedFunction<
  typeof requireCustomerPhoneMatch
>;

const srcRoot = path.join(__dirname, '../..');
function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

function assertNoSensitiveLeak(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED|stackTrace|at Object\./i);
  expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|password=/i);
  expect(text).not.toMatch(/Shiprocket order creation failed:|Pidge API|Delhivery API error/i);
  expect((body as any)?.stack).toBeUndefined();
}

const logisticsSrc = 'endpoints/logistics.ts';
const vendorDashSrc = 'endpoints/vendor/endpoints/vendor-dashboard-enhanced.ts';
const customerEnhancedFiles = [
  'endpoints/customer/enhanced/services/enhanced-base-handlers.service.ts',
  'endpoints/customer/enhanced/services/customer_phone_preferences_get.service.ts',
  'endpoints/customer/enhanced/services/customer_phone_subscriptions_active_get.service.ts',
  'endpoints/customer/enhanced/services/customer_phone_onboarding_complete_post.service.ts',
  'endpoints/customer/enhanced/services/customer_phone_bookings_activetracking_get.service.ts',
  'endpoints/customer/enhanced/services/customer_pets_post.service.ts',
  'endpoints/customer/enhanced/services/customer_paymentmethods_post.service.ts',
  'endpoints/customer/enhanced/services/customer_orders_orderid_pharmacystatus_get.service.ts',
  'endpoints/customer/enhanced/services/customer_phone_orders_pharmacy_active_get.service.ts',
];

describe('Batch 3 — source contracts (no raw error.message to clients)', () => {
  it('logistics does not return raw error.message on catch paths', () => {
    const src = read(logisticsSrc);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message/);
    expect(src).not.toMatch(/return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message/);
    expect(src).not.toMatch(/return \{ success: false, error: error\.message \}/);
    expect(src).not.toMatch(/JSON\.stringify\(error\)/);
  });

  it('vendor-dashboard-enhanced does not return raw error.message on 500', () => {
    const src = read(vendorDashSrc);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message\s*\},\s*500\)/);
  });

  it.each(customerEnhancedFiles)('%s has no client-facing error.message', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/error:\s*error\.message/);
    expect(src).not.toMatch(/error\.message\s*\|\|\s*['"]Failed/);
    expect(src).not.toMatch(/NODE_ENV === ['"]development['"] \? error\.message/);
  });
});

describe('Batch 3 — Logistics runtime handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInsert.mockResolvedValue([] as any);
  });

  it('POST /logistics/shiprocket/create-order unexpected DB/provider error is sanitized', async () => {
    const app = new Hono();
    registerLogisticsEndpoints(app);
    // Force catch by rejecting JSON body parse path via throwing inside handler:
    // mock getSecretJson used by token path — simplest: throw from insert after
    // Actually create-order calls getShiprocketToken which may throw. Mock secrets to throw.
    const { getSecretJson } = require('../aws/secrets-manager');
    (getSecretJson as jest.Mock).mockRejectedValueOnce(
      new Error('relation "shipments" does not exist — SELECT * FROM shipments'),
    );

    const res = await app.request('http://localhost/logistics/shiprocket/create-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'o1',
        pickup: { city: 'X', state: 'Y', pincode: '560001' },
        delivery: { city: 'A', state: 'B', pincode: '560002' },
        weight: 1,
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/relation "|shipments|SELECT/i);
    assertNoSensitiveLeak(body);
  });

  it('POST /logistics/pidge/create-order provider failure does not echo provider message', async () => {
    mockedPidgeCreate.mockRejectedValueOnce(
      new Error('Pidge HTTP 500: {"error":"internal sql dump relation vendors"}'),
    );
    const app = new Hono();
    registerLogisticsEndpoints(app);
    const res = await app.request('http://localhost/logistics/pidge/create-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brand: 'x', channel: 'y', sender_detail: {}, poc_detail: {}, trips: [] }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/Pidge HTTP|relation vendors|sql dump/i);
    assertNoSensitiveLeak(body);
  });

  it('POST /logistics/calculate-shipping preserves business validation 400', async () => {
    const app = new Hono();
    registerLogisticsEndpoints(app);
    const res = await app.request('http://localhost/logistics/calculate-shipping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pickupPincode: '560001' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/pickupPincode.*deliveryPincode.*weight/i);
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('GET /logistics/pidge/order/:id missing id remains intentional 400', async () => {
    const app = new Hono();
    registerLogisticsEndpoints(app);
    const res = await app.request('http://localhost/logistics/pidge/order/%20');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/id path parameter/i);
  });
});

describe('Batch 3 — Customer Enhanced runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPhoneAuth.mockResolvedValue({
      ok: true,
      customerId: '11111111-1111-4111-8111-111111111111',
    } as any);
  });

  function makeCtx(path: string) {
    const app = new Hono();
    app.get(path, (c) => executecustomerPhonePreferencesGet(c));
    return app;
  }

  it('preferences GET unexpected DB error is sanitized', async () => {
    mockedPrefsRepo.mockRejectedValueOnce(
      new Error('column "preferences_secret" does not exist'),
    );
    // findCustomerByPhone succeeds; repo throw happens after .catch(() => empty) on prefs —
    // force outer catch by making phone auth throw? Better: make findCustomerByPhone throw.
    const { findCustomerByPhone } = require('../customer-phone-lookup');
    (findCustomerByPhone as jest.Mock).mockRejectedValueOnce(
      new Error('relation "customers" does not exist password=secret'),
    );

    const app = makeCtx('/customer/:phone/preferences');
    const res = await app.request('http://localhost/customer/9999999999/preferences');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/relation "|password=secret|preferences_secret/i);
    assertNoSensitiveLeak(body);
  });

  it('preferences GET preserves authz business denial', async () => {
    mockedPhoneAuth.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'Forbidden',
    } as any);
    const app = makeCtx('/customer/:phone/preferences');
    const res = await app.request('http://localhost/customer/9999999999/preferences');
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Forbidden');
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('subscriptions soft-fail does not embed exception message', async () => {
    const subsRepo = require('../../endpoints/customer/enhanced/repos/customer_phone_subscriptions_active_get.repo');
    (subsRepo.dbCustomerPhoneSubscriptionsActiveGet0 as jest.Mock).mockRejectedValueOnce(
      new Error('SELECT * FROM meal_subscriptions WHERE phone=9999999999'),
    );
    const app = new Hono();
    app.get('/customer/:phone/subscriptions/active', (c) =>
      executecustomerPhoneSubscriptionsActiveGet(c),
    );
    const res = await app.request(
      'http://localhost/customer/9999999999/subscriptions/active',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.hasActiveSubscription).toBe(false);
    expect(body.error).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/SELECT|meal_subscriptions/i);
    assertNoSensitiveLeak(body);
  });
});

describe('Batch 3 — Vendor Dashboard Enhanced runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /vendor/dashboard/:id unexpected DB failure is sanitized', async () => {
    mockedSelect.mockRejectedValueOnce(
      new Error('relation "vendors" does not exist'),
    );
    const app = new Hono();
    registerVendorDashboardEnhancedEndpoints(app);
    const vendorId = '11111111-1111-4111-8111-111111111111';
    const res = await app.request(`http://localhost/vendor/dashboard/${vendorId}`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/relation "|vendors/i);
    assertNoSensitiveLeak(body);
  });

  it('GET /vendor/dashboard/test-vendor-id success contract unchanged', async () => {
    const app = new Hono();
    registerVendorDashboardEnhancedEndpoints(app);
    const res = await app.request('http://localhost/vendor/dashboard/test-vendor-id');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.vendor.vendorId).toBe('test-vendor-id');
    expect(body.stats).toBeDefined();
  });
});

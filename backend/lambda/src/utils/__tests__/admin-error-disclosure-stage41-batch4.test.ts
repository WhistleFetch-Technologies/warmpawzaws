/**
 * Stage 4.1 Batch 4 — Admin error disclosure remediation regression (closure batch).
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

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

jest.mock('../aws/aws-clients', () => ({
  publishToSNS: jest.fn(async () => undefined),
  sendToSQS: jest.fn(async () => undefined),
}));

jest.mock('../../lib/services/referral-program-settings', () => ({
  getReferralProgramSettings: jest.fn(),
}));

jest.mock('../notification-delivery', () => ({
  ensureDeliveryLogEntries: jest.fn(),
  finalizeInAppDelivery: jest.fn(),
  getDeliveryLogForNotification: jest.fn(),
  getDeliveryStats: jest.fn(async () => ({})),
  resolveChannelsFromRequest: jest.fn(async () => []),
}));

jest.mock('../scheduled-notification-drain', () => ({
  purgeOldNotificationDeliveryLogs: jest.fn(),
}));

jest.mock('../notification-pipeline-kill-switch', () => ({
  cronPipelineSkippedPayload: jest.fn(() => ({ success: true, skipped: true })),
  isNotificationCronEnabled: jest.fn(() => true),
}));

jest.mock('../vendor-booking-earnings-report', () => ({
  fetchAllVendorBookingEarningsLinesForIstRange: jest.fn(),
  fetchVendorBookingEarningsForIstDay: jest.fn(),
  fetchVendorBookingEarningsForIstMonth: jest.fn(),
}));

jest.mock('../settlement-audit-csv', () => ({
  buildSettlementAuditCsv: jest.fn(() => 'a,b\n'),
}));

jest.mock('../../lib/services/admin/admin-booking-cancel-service', () => {
  class AdminCancelError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    AdminCancelError,
    adminCanCancelAndRefund: jest.fn(async () => true),
    executeAdminBookingCancel: jest.fn(),
    normalizeAdminRefundAmountMode: jest.fn(() => 'full'),
    normalizeAdminRefundMethod: jest.fn(() => 'wallet'),
    previewAdminBookingCancel: jest.fn(),
  };
});

jest.mock('../../endpoints/admin/endpoints/admin.controller', () => ({
  requireAdminAuth: jest.fn(async () => ({ authorized: true, userId: 'admin-1' })),
  registerAdminEndpoints: jest.fn(),
}));

jest.mock('../../endpoints/customer/delivery-fee/repos/get-admin-delivery-fee-policy.repo', () => ({
  dbGetAdminDeliveryFeePolicy0: jest.fn(),
}));

jest.mock('../../endpoints/customer/delivery-fee/repos/put-admin-delivery-fee-policy.repo', () => ({
  dbPutAdminDeliveryFeePolicy0: jest.fn(),
  dbPutAdminDeliveryFeePolicy1: jest.fn(),
  dbPutAdminDeliveryFeePolicy2: jest.fn(),
}));

import { query, select, insert } from '../../database/rds-connection';
import { getReferralProgramSettings } from '../../lib/services/referral-program-settings';
import { purgeOldNotificationDeliveryLogs } from '../scheduled-notification-drain';
import {
  AdminCancelError,
  previewAdminBookingCancel,
} from '../../lib/services/admin/admin-booking-cancel-service';
import { fetchVendorBookingEarningsForIstDay } from '../vendor-booking-earnings-report';
import * as getAdminDeliveryFeeRepo from '../../endpoints/customer/delivery-fee/repos/get-admin-delivery-fee-policy.repo';
import { registerAdminVendorDailyAccrualEndpoints } from '../../endpoints/admin/endpoints/admin-vendor-daily-accrual';
import { registerAdminVendorBookingEarningsEndpoints } from '../../endpoints/admin/endpoints/admin-vendor-booking-earnings';
import { registerAdminCustomServicesEndpoints } from '../../endpoints/admin/endpoints/admin-custom-services';
import { registerDiscoveryRulesAdminEndpoints } from '../../endpoints/discovery-rules-admin';
import { registerSubscriptionPlansAdminEndpoints } from '../../endpoints/subscription-plans-admin';
import { registerAdminSellersEndpoints } from '../../endpoints/admin/endpoints/admin-sellers';
import { registerAdminGovernanceEndpoints } from '../../endpoints/admin/endpoints/admin-governance';
import { registerAdminBookingCancelEndpoints } from '../../endpoints/admin/endpoints/admin-booking-cancel-endpoints';
import { registerAdminNotificationDeliveryEndpoints } from '../../endpoints/admin/endpoints/admin-notification-delivery';
import { registerAdminReferralsEndpoints } from '../../endpoints/admin/endpoints/admin-referrals';
import { registerAdminMealLogisticsEndpoints } from '../../endpoints/admin/endpoints/admin-meal-logistics';
import { registerOnboardingFormManagementEndpoints } from '../../endpoints/onboarding-form-management';
import { executegetAdminDeliveryFeePolicy } from '../../endpoints/customer/delivery-fee/services/get-admin-delivery-fee-policy.service';
import { executeputAdminDeliveryFeePolicy } from '../../endpoints/customer/delivery-fee/services/put-admin-delivery-fee-policy.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;
const mockedInsert = insert as jest.MockedFunction<typeof insert>;
const mockedReferral = getReferralProgramSettings as jest.MockedFunction<typeof getReferralProgramSettings>;
const mockedPurge = purgeOldNotificationDeliveryLogs as jest.MockedFunction<
  typeof purgeOldNotificationDeliveryLogs
>;
const mockedPreviewCancel = previewAdminBookingCancel as jest.MockedFunction<
  typeof previewAdminBookingCancel
>;
const mockedEarningsDay = fetchVendorBookingEarningsForIstDay as jest.MockedFunction<
  typeof fetchVendorBookingEarningsForIstDay
>;
const mockedGetPolicy = getAdminDeliveryFeeRepo.dbGetAdminDeliveryFeePolicy0 as jest.MockedFunction<
  typeof getAdminDeliveryFeeRepo.dbGetAdminDeliveryFeePolicy0
>;

const srcRoot = path.join(__dirname, '../..');
function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

const batch4Files = [
  'endpoints/admin/endpoints/admin-vendor-daily-accrual.ts',
  'endpoints/admin/endpoints/admin-vendor-booking-earnings.ts',
  'endpoints/admin/endpoints/admin-custom-services.ts',
  'endpoints/discovery-rules-admin.ts',
  'endpoints/subscription-plans-admin.ts',
  'endpoints/admin/endpoints/admin-sellers.ts',
  'endpoints/admin/endpoints/admin-governance.ts',
  'endpoints/admin/endpoints/admin-booking-cancel-endpoints.ts',
  'endpoints/admin/endpoints/admin-notification-delivery.ts',
  'endpoints/admin/endpoints/admin-referrals.ts',
  'endpoints/customer/delivery-fee/services/get-admin-delivery-fee-policy.service.ts',
  'endpoints/customer/delivery-fee/services/put-admin-delivery-fee-policy.service.ts',
  'endpoints/admin/endpoints/admin-meal-logistics.ts',
  'endpoints/admin/endpoints/admin-comprehensive.ts',
  'endpoints/admin/endpoints/admin-customer-endpoints.ts',
  'endpoints/onboarding-form-management.ts',
];

function assertNoSensitiveLeak(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  expect(text).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED|AccessDenied|stackTrace|at Object\./i);
  expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|aws_secret|client_secret=/i);
}

describe('Stage 4.1 Batch 4 — source contracts', () => {
  it.each(batch4Files)('%s imports SAFE_INTERNAL_ERROR_MESSAGE', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/from ['"].*safe-hono-error['"]/);
  });

  it.each(batch4Files)('%s does not return raw unexpected exception messages', (rel) => {
    const src = read(rel);
    const withoutTyped = src
      .replace(
        /if \(error instanceof AdminCancelError\)[\s\S]*?return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message[\s\S]*?;/g,
        '',
      )
      .replace(
        /if \(error instanceof ImageProcessingError\)[\s\S]*?return c\.json\(\{\s*error:\s*error\.message[\s\S]*?;/g,
        '',
      );
    expect(withoutTyped).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message/);
    expect(withoutTyped).not.toMatch(/return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message/);
    expect(withoutTyped).not.toMatch(/return c\.json\(\{\s*success:\s*false,\s*error:\s*error\?\.message/);
    expect(withoutTyped).not.toMatch(/return c\.json\(\{\s*success:\s*false,\s*error:\s*e\?\.message/);
    expect(withoutTyped).not.toMatch(/return c\.json\(\{\s*error:\s*\(error as Error\)\.message/);
    expect(withoutTyped).not.toMatch(/return this\.error\(error\.message/);
    expect(withoutTyped).not.toMatch(/return this\.error\(`[^`]*\$\{error\.message\}/);
    expect(withoutTyped).not.toMatch(/return c\.text\(error\?\.message/);
    expect(withoutTyped).not.toMatch(/delivery-service unreachable: \$\{message\}/);
  });

  it('booking-cancel preserves AdminCancelError typed path', () => {
    const src = read('endpoints/admin/endpoints/admin-booking-cancel-endpoints.ts');
    expect(src).toMatch(
      /if \(error instanceof AdminCancelError\)[\s\S]{0,120}error:\s*error\.message,\s*code:\s*error\.code/,
    );
    expect(src).toMatch(/error:\s*SAFE_INTERNAL_ERROR_MESSAGE/);
  });

  it('onboarding nested results use SAFE_INTERNAL', () => {
    const src = read('endpoints/onboarding-form-management.ts');
    expect(src).toMatch(/status:\s*'error',\s*\n\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).not.toMatch(/status:\s*'error',\s*\n\s*error:\s*error\.message/);
  });

  it('accrual preserves intentional table-missing 503 business messages', () => {
    const src = read('endpoints/admin/endpoints/admin-vendor-daily-accrual.ts');
    expect(src).toMatch(/vendor_daily_accrual table missing/);
    expect(src).toMatch(/vendor_earnings table not found/);
    expect(src).toMatch(/return c\.json\(\{ success: false, error: 'vendor_earnings table not found' \}, 503\)/);
  });

  it('sellers and plans preserve intentional validation messages', () => {
    const sellers = read('endpoints/admin/endpoints/admin-sellers.ts');
    const plans = read('endpoints/subscription-plans-admin.ts');
    expect(sellers).toMatch(/this\.error\('Vendor ID is required',\s*400\)/);
    expect(sellers).toMatch(/this\.error\('Vendor not found',\s*404\)/);
    expect(plans).toMatch(/this\.error\('Name and price are required',\s*400\)/);
  });

  it('comprehensive and customer residuals are sanitized', () => {
    const comprehensive = read('endpoints/admin/endpoints/admin-comprehensive.ts');
    const customer = read('endpoints/admin/endpoints/admin-customer-endpoints.ts');
    expect(comprehensive).toMatch(
      /vendor-portal-code[\s\S]{0,500}error:\s*SAFE_INTERNAL_ERROR_MESSAGE/,
    );
    expect(comprehensive).not.toMatch(/Failed to create portal code/);
    expect(customer).not.toMatch(/error:\s*error\?\.message\s*\|\|\s*'Failed'/);
  });
});

describe('Stage 4.1 Batch 4 — accrual / earnings runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedEarningsDay.mockReset();
  });

  it('accrual compute unexpected exception returns generic 500', async () => {
    // Pass tableExists checks, then fail during compute/settlement work.
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ ex: true }] } as any) // vendor_daily_accrual exists
      .mockResolvedValueOnce({ rows: [{ ex: true }] } as any) // vendor_earnings exists
      .mockRejectedValue(new Error('column "realized_at" does not exist'));
    const app = new Hono();
    registerAdminVendorDailyAccrualEndpoints(app);
    const res = await app.request('http://localhost/admin/finance/vendor-daily-accrual/compute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportDate: '2026-01-01' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('accrual compute table-missing remains intentional 503', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ ex: false }] } as any);
    const app = new Hono();
    registerAdminVendorDailyAccrualEndpoints(app);
    const res = await app.request('http://localhost/admin/finance/vendor-daily-accrual/compute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportDate: '2026-01-01' }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/vendor_daily_accrual table missing/i);
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('earnings report unexpected exception returns generic 500', async () => {
    mockedEarningsDay.mockRejectedValueOnce(new Error('column "realized_at" does not exist'));
    const app = new Hono();
    registerAdminVendorBookingEarningsEndpoints(app);
    const res = await app.request(
      'http://localhost/admin/finance/vendor-booking-earnings?reportDate=2026-01-01',
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Batch 4 — CRUD / governance / referrals runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSelect.mockReset();
    mockedReferral.mockReset();
  });

  it('custom-services unexpected failure is sanitized', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('relation "vendor_services" does not exist'));
    const app = new Hono();
    registerAdminCustomServicesEndpoints(app);
    const res = await app.request('http://localhost/admin/custom-services/pending');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('discovery-rules unexpected failure is sanitized', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('relation "discovery_rules" does not exist'));
    const app = new Hono();
    registerDiscoveryRulesAdminEndpoints(app);
    const res = await app.request('http://localhost/admin/discovery-rules');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('referrals unexpected failure is sanitized', async () => {
    mockedReferral.mockRejectedValueOnce(new Error('ECONNREFUSED 127.0.0.1'));
    const app = new Hono();
    registerAdminReferralsEndpoints(app);
    const res = await app.request('http://localhost/admin/referral-program-settings');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('sellers list unexpected failure is sanitized via BaseHandler', async () => {
    mockedQuery.mockRejectedValue(new Error('timeout exceeded'));
    const app = new Hono();
    registerAdminSellersEndpoints(app);
    const res = await app.request('http://localhost/admin/vendors/sellers');
    expect(res.status).toBe(500);
    // Sellers wrappers pass HandlerResponse.body (already JSON string) into c.json().
    const raw = (await res.json()) as any;
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/timeout exceeded/i);
    assertNoSensitiveLeak(body);
  });

  it('governance propagate unexpected failure is sanitized', async () => {
    const app = new Hono();
    registerAdminGovernanceEndpoints(app);
    const res = await app.request('http://localhost/admin/governance/propagate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'banner' }),
    });
    // May hit SNS/query mocks; if 500, must be safe
    if (res.status === 500) {
      const body = (await res.json()) as any;
      expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
      assertNoSensitiveLeak(body);
    } else {
      expect([200, 400]).toContain(res.status);
    }
  });

  it('subscription plans create validation 400 remains intact', async () => {
    const app = new Hono();
    registerSubscriptionPlansAdminEndpoints(app);
    const res = await app.request('http://localhost/admin/subscriptions/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(String(body.error || body.message || '')).toMatch(/Name and price are required/i);
  });
});

describe('Stage 4.1 Batch 4 — booking cancel / notifications / meal logistics', () => {
  beforeEach(() => {
    mockedPreviewCancel.mockReset();
    mockedPurge.mockReset();
    mockedInsert.mockReset();
  });

  it('booking cancel preserves AdminCancelError', async () => {
    mockedPreviewCancel.mockRejectedValueOnce(
      new AdminCancelError('Booking not found', 404, 'BOOKING_NOT_FOUND'),
    );
    const app = new Hono();
    registerAdminBookingCancelEndpoints(app);
    const res = await app.request(
      'http://localhost/admin/bookings/abcd1234/cancel-preview?refundMethod=wallet&amountMode=full',
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Booking not found');
    expect(body.code).toBe('BOOKING_NOT_FOUND');
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('booking cancel unexpected exception is sanitized', async () => {
    mockedPreviewCancel.mockRejectedValueOnce(new Error('relation "bookings" does not exist'));
    const app = new Hono();
    registerAdminBookingCancelEndpoints(app);
    const res = await app.request(
      'http://localhost/admin/bookings/abcd1234/cancel-preview?refundMethod=wallet&amountMode=full',
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('notification retention unexpected exception is sanitized', async () => {
    mockedPurge.mockRejectedValueOnce(new Error('permission denied for table notification_delivery_log'));
    const app = new Hono();
    registerAdminNotificationDeliveryEndpoints(app);
    const res = await app.request('http://localhost/admin/notifications/delivery-log/retention', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('meal-logistics 502 does not expose internal exception details', async () => {
    const prev = process.env.DELIVERY_SERVICE_BASE_URL;
    process.env.DELIVERY_SERVICE_BASE_URL = 'http://127.0.0.1:9';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:9')) as any;
    try {
      const app = new Hono();
      registerAdminMealLogisticsEndpoints(app);
      const res = await app.request('http://localhost/admin/meal-orders/m1/reassign-rider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as any;
      expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
      expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/i);
      assertNoSensitiveLeak(body);
    } finally {
      global.fetch = originalFetch;
      if (prev === undefined) delete process.env.DELIVERY_SERVICE_BASE_URL;
      else process.env.DELIVERY_SERVICE_BASE_URL = prev;
    }
  });
});

describe('Stage 4.1 Batch 4 — delivery-fee admin services', () => {
  beforeEach(() => {
    mockedGetPolicy.mockReset();
  });

  it('GET admin delivery-fee unexpected exception is sanitized', async () => {
    mockedGetPolicy.mockRejectedValueOnce(new Error('relation "platform_settings" does not exist'));
    const c = {
      json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
    } as any;
    const result = (await executegetAdminDeliveryFeePolicy(c)) as any;
    expect(result.status).toBe(500);
    expect(result.body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(result.body);
  });

  it('PUT admin delivery-fee validation 400 remains intact', async () => {
    const c = {
      req: { json: async () => ({ policy: { notAValid: true } }) },
      json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
    } as any;
    const result = (await executeputAdminDeliveryFeePolicy(c)) as any;
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBeTruthy();
    expect(result.body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });
});

describe('Stage 4.1 Batch 4 — onboarding runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSelect.mockReset();
  });

  it('onboarding top-level unexpected exception is sanitized', async () => {
    mockedSelect.mockRejectedValueOnce(new Error('relation "vendor_roles" does not exist'));
    const app = new Hono();
    registerOnboardingFormManagementEndpoints(app);
    const res = await app.request('http://localhost/admin/onboarding-fields/migrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('onboarding nested results[].error is sanitized on per-role failure', async () => {
    mockedSelect
      .mockResolvedValueOnce([{ id: 'r1', name: 'vet', display_name: 'Vet', status: 'active' }] as any)
      .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    // migrate path may use query for fields — keep flexible
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const app = new Hono();
    registerOnboardingFormManagementEndpoints(app);
    const res = await app.request('http://localhost/admin/onboarding-fields/migrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Either top-level 500 or success with nested sanitized errors depending on control flow
    const body = (await res.json()) as any;
    if (res.status === 500) {
      expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    } else {
      const nested = (body.results || []).filter((r: any) => r.status === 'error');
      for (const n of nested) {
        expect(n.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
        expect(String(n.error)).not.toMatch(/duplicate key|violates unique/i);
      }
    }
    assertNoSensitiveLeak(body);
  });
});

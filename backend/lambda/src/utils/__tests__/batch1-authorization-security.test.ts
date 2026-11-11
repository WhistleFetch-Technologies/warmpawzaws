/**
 * Batch 1 — Authorization & mutation security regression tests.
 * Mocks migration/DDL and DB mutations; never executes real migrations.
 */
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  deleteRows: jest.fn(),
  upsert: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

jest.mock('../aws/secrets-manager', () => ({
  getSecret: jest.fn(),
  getSecretJson: jest.fn(),
  putSecret: jest.fn(),
}));

const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'GetObject' })),
  ListBucketsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://example.test/presigned'),
}));

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  GetCallerIdentityCommand: jest.fn(),
}));

jest.mock('../payments/razorpay-client', () => ({
  getRazorpayClient: jest.fn(),
  resolveRazorpayPayoutSourceAccountNumber: jest.fn(),
}));

jest.mock('../vendor-bank-for-payout', () => ({
  fetchVendorBankRowsForPayout: jest.fn(async () => []),
}));

jest.mock('../sns-client', () => ({
  getSnsClient: jest.fn(() => ({ send: jest.fn() })),
}));

jest.mock('@aws-sdk/client-sns', () => ({
  PublishCommand: jest.fn(),
}));

jest.mock('../../aws/aws-sns-notification-service', () => ({
  pushNotificationService: { send: jest.fn() },
}));

jest.mock('../../lib/utils/uat-mode', () => ({
  isUATMode: jest.fn(() => false),
}));

jest.mock('../../middleware/validation-middleware', () => ({
  validateBody: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

jest.mock('../../zodContracts/settlement.contract', () => ({
  processPayoutSchema: {},
}));

jest.mock('../payments/payout-status-sync-service', () => ({
  PayoutStatusSyncService: jest.fn(),
}));

jest.mock('../temporary-vendor-ui-suppression', () => ({
  getTemporaryVendorSuppressionParams: jest.fn(() => ({})),
  shouldHideSettlementRowFromAdminUi: jest.fn(() => false),
  sqlExcludeSuppressedSettlementRows: jest.fn(() => ''),
}));

jest.mock('../meal-order-settlement', () => ({
  sumPendingDeliverySettlementNetPayout: jest.fn(async () => 0),
}));

jest.mock('../delivery-settlement-finance', () => ({
  fetchEligibleDeliverySettlementsForBatchPayout: jest.fn(async () => []),
  safeMoneyAmount: (n: unknown) => Number(n) || 0,
}));

jest.mock('../../finance/settlement/finance-settlement-mode', () => ({
  useFundingAwareSettlementBatch: jest.fn(() => false),
}));

jest.mock('../../finance/settlement/aggregate-vendor-earnings-batch', () => ({
  fetchEligibleVendorEarningsForBatch: jest.fn(async () => []),
}));

jest.mock('../../lib/services/pidge-logistics', () => ({
  getPidgeCredentials: jest.fn(),
  fetchPidgeVendorToken: jest.fn(),
}));

jest.mock('../../endpoints/razorpay/endpoints/razorpay.razorpay', () => ({
  validateBankAccountStrict: jest.fn(),
}));

jest.mock('../vendor-resolve', () => ({
  resolveVendorId: jest.fn(async (id: string) => id),
  resolveVendorIdsForLedger: jest.fn(async (id: string) => [id]),
}));

jest.mock('../customer-id-from-auth', () => ({
  resolveCustomerIdFromHonoContext: jest.fn(),
}));

jest.mock('../customer-coordinates', () => ({
  resolveCustomerIdFromPhone: jest.fn(),
}));

jest.mock('../aws/aws-clients', () => ({
  uploadToS3: jest.fn(),
  generateS3Key: jest.fn(),
}));

jest.mock('../../endpoints/vendor/endpoints/vendorProfile.vendor', () => ({
  resolveVendorById: jest.fn(async (id: string) => ({ id })),
}));

jest.mock('../vendor-bank-primary', () => ({
  promoteVendorBankAccountToPrimary: jest.fn(),
}));

jest.mock('../sync-vendor-bank-verified', () => ({
  markVendorBankVerified: jest.fn(),
}));

jest.mock('../vendor-address-geocode', () => ({
  geocodeVendorAddressFields: jest.fn(),
}));

jest.mock('../../endpoints/customer/discovery/repos/legacy-helpers.repo', () => ({
  columnExists: jest.fn(async () => true),
  sqlVendorMatchesDeclaredSpecialization: jest.fn(),
}));

jest.mock('../../endpoints/customer/discovery/repos/debug-training-vendors.repo', () => ({
  dbDebugTrainingVendors0: jest.fn(async () => ({
    rows: [{ id: 'v1', business_name: 'Secret Trainer', latitude: 12.9, longitude: 77.6 }],
  })),
  dbDebugTrainingVendors1: jest.fn(async () => ({ rows: [{ id: 'v1' }] })),
  dbDebugTrainingVendors2: jest.fn(async () => ({ rows: [{ phone: '9999999999' }] })),
  dbDebugTrainingVendors3: jest.fn(async () => ({ rows: [{ key: 'basic_obedience' }] })),
  dbDebugTrainingVendors4: jest.fn(async () => ({ rows: [{ id: 'v1' }] })),
}));

import { query, select, insert, update } from '../../database/rds-connection';
import { resolveCustomerIdFromHonoContext } from '../customer-id-from-auth';
import { resolveVendorId, resolveVendorIdsForLedger } from '../vendor-resolve';
import { isAdminRole } from '../security-ownership';
import { registerAdminIntegrationEndpoints } from '../../endpoints/admin/endpoints/admin-integrations';
import { registerAnalyticsEndpoints } from '../../endpoints/admin/endpoints/analytics.admin';
import { registerMedicalRecordsEndpoints } from '../../endpoints/medical-records';
import { registerDebugTrainingVendorsRoute } from '../../endpoints/customer/discovery/routes/debug-training-vendors.route';
import { registerDebugAtCenterVendorsRoute } from '../../endpoints/customer/discovery/routes/debug-at-center-vendors.route';
import { registerVendorBankAccountEndpoints } from '../../endpoints/vendor/endpoints/vendor-bank-accounts';
import { registerSettlementEndpoints } from '../../endpoints/settlement&payouts/endpoints/settlements';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;
const mockedInsert = insert as jest.MockedFunction<typeof insert>;
const mockedUpdate = update as jest.MockedFunction<typeof update>;
const mockedAuthCustomer = resolveCustomerIdFromHonoContext as jest.MockedFunction<
  typeof resolveCustomerIdFromHonoContext
>;
const mockedResolveVendorId = resolveVendorId as jest.MockedFunction<typeof resolveVendorId>;
const mockedResolveVendorIds = resolveVendorIdsForLedger as jest.MockedFunction<
  typeof resolveVendorIdsForLedger
>;

const VENDOR_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VENDOR_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CUSTOMER_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BOOKING_A = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const BOOKING_B = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const STAFF_OK = '11111111-1111-4111-8111-111111111111';
const STAFF_BAD = '22222222-2222-4222-8222-222222222222';

function assertNoBankOrPayoutMutation() {
  const sqls = mockedQuery.mock.calls.map((c) => String(c[0] || ''));
  expect(sqls.some((s) => /INSERT\s+INTO\s+payouts/i.test(s))).toBe(false);
  expect(sqls.some((s) => /INSERT\s+INTO\s+settlements/i.test(s))).toBe(false);
  expect(mockedInsert).not.toHaveBeenCalled();
  expect(mockedUpdate).not.toHaveBeenCalled();
}

function bankSelectOccurred() {
  return mockedQuery.mock.calls.some((c) =>
    /vendor_bank_accounts|vendor_bank_details/i.test(String(c[0] || '')),
  ) || mockedSelect.mock.calls.some((c) => String(c[0] || '').includes('vendor_bank'));
}

function roleApp(
  register: (app: Hono) => void,
  opts?: { userId?: string; role?: string },
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    const role = c.req.header('x-test-role') ?? opts?.role;
    const userId = c.req.header('x-test-user') ?? opts?.userId;
    if (role) {
      (c as any).set('userRole', role);
      (c as any).set('userGroups', [role]);
    }
    if (userId) {
      (c as any).set('userId', userId);
    }
    await next();
  });
  register(app);
  return app;
}

function headers(role?: string, userId?: string, contentType: string | null = 'application/json') {
  const h: Record<string, string> = {};
  if (contentType) h['Content-Type'] = contentType;
  if (role) h['x-test-role'] = role;
  if (userId) h['x-test-user'] = userId;
  return h;
}

describe('Batch 1 F01 — POST /system/run-pending-migrations', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../handler/index.ts'),
    'utf8',
  );
  const start = src.indexOf("app.post('/system/run-pending-migrations'");
  const end = src.indexOf("// Require authentication for admin endpoints", start);
  const slice = src.slice(start, end > start ? end : start + 20000);

  it('registers admin gate before any DDL query', () => {
    expect(start).toBeGreaterThan(-1);
    expect(slice).toMatch(/isAdminRole/);
    expect(slice.indexOf('isAdminRole')).toBeLessThan(slice.indexOf('dbQuery'));
    expect(slice).toMatch(/ADMIN_REQUIRED/);
  });

  it('does not expose raw err.message or vendor column dump in success path', () => {
    expect(slice).not.toMatch(/message: err\.message/);
    expect(slice).toMatch(/Migration step failed/);
    expect(slice).toMatch(/total_vendor_columns/);
    expect(slice).not.toMatch(/\bvendor_columns:\s*verifyResult\.rows\.map/);
    expect(slice).toMatch(/Migration execution failed/);
  });

  it('behavioral gate: non-admin never reaches migrate fn; admin does', async () => {
    const migrateFn = jest.fn(async () => ({ ok: true }));
    const app = new Hono();
    app.use('*', async (c, next) => {
      const role = c.req.header('x-test-role');
      if (role) {
        (c as any).set('userRole', role);
        (c as any).set('userGroups', [role]);
      }
      await next();
    });
    // Mirrors production gate order in handler/index.ts
    app.post('/system/run-pending-migrations', async (c) => {
      if (!isAdminRole(c)) {
        return c.json({ success: false, error: 'Forbidden', code: 'ADMIN_REQUIRED' }, 403);
      }
      await migrateFn();
      return c.json({ success: true });
    });

    const unauth = await app.request('http://localhost/system/run-pending-migrations', {
      method: 'POST',
    });
    expect(unauth.status).toBe(403);
    expect(migrateFn).not.toHaveBeenCalled();

    for (const role of ['customer', 'vendor', 'staff']) {
      migrateFn.mockClear();
      const res = await app.request('http://localhost/system/run-pending-migrations', {
        method: 'POST',
        headers: headers(role),
      });
      expect(res.status).toBe(403);
      expect(migrateFn).not.toHaveBeenCalled();
    }

    migrateFn.mockClear();
    const admin = await app.request('http://localhost/system/run-pending-migrations', {
      method: 'POST',
      headers: headers('admin'),
    });
    expect(admin.status).toBe(200);
    expect(migrateFn).toHaveBeenCalledTimes(1);
  });
});

describe('Batch 1 F04 — PUT /config/google-maps-key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function build() {
    return roleApp(registerAdminIntegrationEndpoints);
  }

  it('denies missing role before mutation (route-level; production missing Bearer → 401)', async () => {
    const res = await build().request('http://localhost/config/google-maps-key', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ apiKey: 'AIzaSyTestKeyxxxxxxxxxxxxxxxxxxx' }),
    });
    expect(res.status).toBe(403);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('denies customer and vendor', async () => {
    for (const role of ['customer', 'vendor']) {
      mockedQuery.mockClear();
      const res = await build().request('http://localhost/config/google-maps-key', {
        method: 'PUT',
        headers: headers(role, CUSTOMER_A),
        body: JSON.stringify({ apiKey: 'AIzaSyTestKeyxxxxxxxxxxxxxxxxxxx' }),
      });
      expect(res.status).toBe(403);
      expect(mockedQuery).not.toHaveBeenCalled();
    }
  });

  it('allows admin upsert', async () => {
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    const res = await build().request('http://localhost/config/google-maps-key', {
      method: 'PUT',
      headers: headers('admin', 'admin-1'),
      body: JSON.stringify({ apiKey: 'AIzaSyTestKeyxxxxxxxxxxxxxxxxxxx' }),
    });
    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalled();
    const sql = String(mockedQuery.mock.calls[0]?.[0] || '');
    expect(sql).toMatch(/platform_settings/i);
  });
});

describe('Batch 1 F05 — POST /medical-records/booking/:bookingId/prescription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
  });

  function build() {
    return roleApp(registerMedicalRecordsEndpoints);
  }

  it('denies customer (403) and does not insert/update', async () => {
    mockedSelect.mockResolvedValue([
      { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
    ] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('customer', CUSTOMER_A),
        body: JSON.stringify({
          medications: [],
          diagnosis: 'x',
          vendorId: VENDOR_A,
        }),
      },
    );
    expect(res.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('rejects forged body vendorId when JWT is vendor B for vendor A booking (404)', async () => {
    mockedSelect.mockResolvedValue([
      { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
    ] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_B),
        body: JSON.stringify({
          medications: [{ name: 'x' }],
          diagnosis: 'x',
          vendorId: VENDOR_A,
        }),
      },
    );
    expect(res.status).toBe(404);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('allows owning vendor and ignores forged body vendorId for persistence', async () => {
    mockedSelect
      .mockResolvedValueOnce([
        { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
      ] as any)
      .mockResolvedValueOnce([{ business_name: 'Clinic A' }] as any);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    mockedInsert.mockResolvedValue([
      { id: 'rec-1', booking_id: BOOKING_A, vendor_id: VENDOR_A },
    ] as any);

    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_A),
        body: JSON.stringify({
          medications: [{ name: 'med' }],
          diagnosis: 'ok',
          vendorId: VENDOR_B, // forged — must not become persisted vendor_id
        }),
      },
    );
    expect(res.status).toBe(200);
    expect(mockedInsert).toHaveBeenCalled();
    const payload = mockedInsert.mock.calls[0]?.[1] as any;
    expect(payload.vendor_id).toBe(VENDOR_A);
    expect(payload.prescribed_by).toBe(VENDOR_A);
  });

  it('fails closed when booking.vendor_id is missing (including admin)', async () => {
    mockedSelect.mockResolvedValue([
      { id: BOOKING_A, vendor_id: null, pet_id: 'pet-1', customer_id: CUSTOMER_A },
    ] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('admin', 'admin-1'),
        body: JSON.stringify({
          medications: [],
          diagnosis: 'x',
          vendorId: VENDOR_A,
        }),
      },
    );
    expect(res.status).toBe(400);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('rejects staffId not associated with booking vendor', async () => {
    mockedSelect
      .mockResolvedValueOnce([
        { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
      ] as any)
      .mockResolvedValueOnce([{ id: STAFF_BAD, vendor_id: VENDOR_B, name: 'Other' }] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_A),
        body: JSON.stringify({
          medications: [],
          diagnosis: 'x',
          staffId: STAFF_BAD,
        }),
      },
    );
    expect(res.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('allows staffId belonging to booking vendor', async () => {
    mockedSelect
      .mockResolvedValueOnce([
        { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
      ] as any)
      .mockResolvedValueOnce([{ id: STAFF_OK, vendor_id: VENDOR_A, name: 'Dr Ok' }] as any);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    mockedInsert.mockResolvedValue([{ id: 'rec-2', vendor_id: VENDOR_A }] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_A),
        body: JSON.stringify({
          medications: [],
          diagnosis: 'ok',
          staffId: STAFF_OK,
        }),
      },
    );
    expect(res.status).toBe(200);
    const payload = mockedInsert.mock.calls[0]?.[1] as any;
    expect(payload.staff_id).toBe(STAFF_OK);
    expect(payload.vendor_id).toBe(VENDOR_A);
  });

  it('allows admin to update existing prescription record', async () => {
    mockedQuery.mockResolvedValue({
      rows: [{ id: 'existing-rec', booking_id: BOOKING_A }],
      rowCount: 1,
    } as any);
    mockedUpdate.mockResolvedValue([] as any);
    mockedSelect
      .mockResolvedValueOnce([
        { id: BOOKING_A, vendor_id: VENDOR_A, pet_id: 'pet-1', customer_id: CUSTOMER_A },
      ] as any)
      .mockResolvedValueOnce([{ business_name: 'Clinic A' }] as any)
      .mockResolvedValueOnce([{ id: 'existing-rec', booking_id: BOOKING_A }] as any);

    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/prescription`,
      {
        method: 'POST',
        headers: headers('admin', 'admin-1'),
        body: JSON.stringify({ medications: [], diagnosis: 'follow-up' }),
      },
    );
    expect(res.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalled();
  });
});

describe('Batch 1 follow-up P0 — upload-prescription IDOR', () => {
  const bookingRow = {
    id: BOOKING_A,
    vendor_id: VENDOR_A,
    pet_id: 'pet-1',
    customer_id: CUSTOMER_A,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Send.mockClear();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
    mockedAuthCustomer.mockResolvedValue(null);
  });

  function build() {
    return roleApp(registerMedicalRecordsEndpoints);
  }

  function formBody(extra: Record<string, string> = {}) {
    const fd = new FormData();
    fd.append(
      'file',
      new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      'rx.pdf',
    );
    fd.append('recordDate', '2026-11-11');
    fd.append('uploadedBy', extra.uploadedBy || 'vendor');
    fd.append('userId', extra.userId || VENDOR_B);
    if (extra.context) fd.append('context', extra.context);
    return fd;
  }

  it('denies missing auth context before S3/DB', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      { method: 'POST', headers: headers(undefined, undefined, null), body: formBody() },
    );
    expect([401, 404]).toContain(res.status);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('denies missing booking before S3/DB', async () => {
    mockedAuthCustomer.mockResolvedValue(CUSTOMER_A);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_B}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('customer', CUSTOMER_A, null),
        body: formBody({ uploadedBy: 'customer', userId: CUSTOMER_A }),
      },
    );
    expect([404, 400]).toContain(res.status);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('allows owning customer; forged multipart identity ignored', async () => {
    mockedAuthCustomer.mockResolvedValue(CUSTOMER_A);
    mockedQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 } as any);
    mockedSelect.mockResolvedValue([bookingRow] as any);
    mockedInsert.mockResolvedValue([{ id: 'up-1' }] as any);

    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        // Let FormData set multipart Content-Type (do not force application/json).
        headers: headers('customer', CUSTOMER_A, null),
        body: formBody({ uploadedBy: 'vendor', userId: VENDOR_B }),
      },
    );
    expect(res.status).toBe(200);
    expect(PutObjectCommand).toHaveBeenCalled();
    expect(mockS3Send).toHaveBeenCalled();
    expect(mockedInsert).toHaveBeenCalled();
    const payload = mockedInsert.mock.calls[0]?.[1] as any;
    expect(payload.created_by).toBe(CUSTOMER_A);
    expect(payload.created_by_role).toBe('system');
    expect(String(payload.description || '')).toMatch(/customer/i);
  });

  it('denies another customer; no S3/DB mutation', async () => {
    mockedAuthCustomer.mockResolvedValue(CUSTOMER_B);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('customer', CUSTOMER_B, null),
        body: formBody({ uploadedBy: 'customer', userId: CUSTOMER_A }),
      },
    );
    expect(res.status).toBe(404);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('allows booking vendor', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    mockedQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 } as any);
    mockedSelect.mockResolvedValue([bookingRow] as any);
    mockedInsert.mockResolvedValue([{ id: 'up-2' }] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_A, null),
        body: formBody({ uploadedBy: 'customer', userId: CUSTOMER_B }),
      },
    );
    expect(res.status).toBe(200);
    expect(mockS3Send).toHaveBeenCalled();
    expect(mockedInsert).toHaveBeenCalled();
    const payload = mockedInsert.mock.calls[0]?.[1] as any;
    expect(payload.created_by).toBe(VENDOR_A);
    expect(payload.created_by_role).toBe('vendor');
  });

  it('denies different vendor', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('vendor', VENDOR_B, null),
        body: formBody(),
      },
    );
    expect(res.status).toBe(404);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('allows staff when JWT resolves to booking vendor (existing resolveVendorId model)', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    mockedResolveVendorId.mockImplementation(async (id: string) =>
      id === STAFF_OK ? VENDOR_A : id,
    );
    mockedQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 } as any);
    mockedSelect.mockResolvedValue([bookingRow] as any);
    mockedInsert.mockResolvedValue([{ id: 'up-3' }] as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('staff', STAFF_OK, null),
        body: formBody(),
      },
    );
    expect(res.status).toBe(200);
    expect(mockS3Send).toHaveBeenCalled();
    expect(mockedInsert).toHaveBeenCalled();
  });

  it('denies unrelated staff', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    mockedResolveVendorId.mockImplementation(async (id: string) =>
      id === STAFF_BAD ? VENDOR_B : id,
    );
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('staff', STAFF_BAD, null),
        body: formBody(),
      },
    );
    expect(res.status).toBe(404);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('admin cannot bypass booking-actor policy', async () => {
    mockedAuthCustomer.mockResolvedValue(null);
    const res = await build().request(
      `http://localhost/medical-records/booking/${BOOKING_A}/upload-prescription`,
      {
        method: 'POST',
        headers: headers('admin', 'admin-1', null),
        body: formBody(),
      },
    );
    expect(res.status).toBe(401);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockedInsert).not.toHaveBeenCalled();
  });
});

describe('Batch 1 F02 — GET /customer/debug/training-vendors', () => {
  function build() {
    return roleApp(registerDebugTrainingVendorsRoute);
  }

  it('denies missing/customer/vendor roles', async () => {
    for (const role of [undefined, 'customer', 'vendor']) {
      const res = await build().request('http://localhost/customer/debug/training-vendors', {
        headers: role ? headers(role) : {},
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/business_name|latitude|longitude|Secret Trainer/i);
    }
  });

  it('admin receives summary only', async () => {
    const res = await build().request('http://localhost/customer/debug/training-vendors', {
      headers: headers('admin'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.summary).toEqual(
      expect.objectContaining({
        training_vendor_count: expect.any(Number),
        by_style_pass_count: expect.any(Number),
      }),
    );
    expect(body.training_vendors_detail).toBeUndefined();
    expect(body.by_style_check).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/business_name|latitude|longitude|Secret Trainer|9999999999/i);
  });

  it('does not break sibling Stage 3 at-center-vendors admin summary', async () => {
    const app = roleApp((a) => {
      registerDebugAtCenterVendorsRoute(a);
      registerDebugTrainingVendorsRoute(a);
    });
    mockedQuery.mockResolvedValue({ rows: [{ c: '2' }], rowCount: 1 } as any);
    const res = await app.request('http://localhost/customer/debug/at-center-vendors', {
      headers: headers('admin'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.summary).toBeDefined();
  });
});

describe('Batch 1 F03 — analytics authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
    mockedAuthCustomer.mockResolvedValue(CUSTOMER_A);
  });

  function build() {
    return roleApp(registerAnalyticsEndpoints);
  }

  it('platform overview denies customer/vendor and allows admin', async () => {
    for (const role of ['customer', 'vendor']) {
      mockedQuery.mockClear();
      const res = await build().request('http://localhost/analytics/platform/overview', {
        headers: headers(role, role === 'vendor' ? VENDOR_A : CUSTOMER_A),
      });
      expect(res.status).toBe(403);
      expect(mockedQuery).not.toHaveBeenCalled();
    }

    mockedQuery.mockResolvedValue({ rows: [{}], rowCount: 1 } as any);
    mockedSelect.mockResolvedValue([] as any);
    const admin = await build().request('http://localhost/analytics/platform/overview', {
      headers: headers('admin', 'admin-1'),
    });
    expect(admin.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalled();
  });

  it('vendor dashboard: wrong vendor denied; own vendor allowed', async () => {
    const denied = await build().request(
      `http://localhost/analytics/vendor/${VENDOR_B}/dashboard`,
      { headers: headers('vendor', VENDOR_A) },
    );
    expect(denied.status).toBe(403);
    expect(mockedSelect).not.toHaveBeenCalled();

    mockedSelect.mockResolvedValue([{ id: VENDOR_A }] as any);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          total_bookings: '0',
          pending_bookings: '0',
          confirmed_bookings: '0',
          completed_bookings: '0',
          cancelled_bookings: '0',
          today_bookings: '0',
          total_revenue: '0',
          this_month_revenue: '0',
        },
      ],
      rowCount: 1,
    } as any);
    const ok = await build().request(
      `http://localhost/analytics/vendor/${VENDOR_A}/dashboard`,
      { headers: headers('vendor', VENDOR_A) },
    );
    expect(ok.status).toBe(200);
  });

  it('vendor revenue: customer denied; cross-vendor denied', async () => {
    const cust = await build().request(
      `http://localhost/analytics/vendor/${VENDOR_A}/revenue`,
      { headers: headers('customer', CUSTOMER_A) },
    );
    expect(cust.status).toBe(403);

    const cross = await build().request(
      `http://localhost/analytics/vendor/${VENDOR_B}/revenue`,
      { headers: headers('vendor', VENDOR_A) },
    );
    expect(cross.status).toBe(403);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('customer dashboard: forged path customerId denied; own allowed', async () => {
    const forged = await build().request(
      `http://localhost/analytics/customer/${CUSTOMER_B}/dashboard`,
      { headers: headers('customer', CUSTOMER_A) },
    );
    expect(forged.status).toBe(403);
    expect(mockedSelect).not.toHaveBeenCalled();

    mockedSelect.mockResolvedValue([] as any);
    mockedQuery.mockResolvedValue({
      rows: [{ total_bookings: '0', upcoming_bookings: '0', completed_bookings: '0', total_spent: '0' }],
      rowCount: 1,
    } as any);
    const ok = await build().request(
      `http://localhost/analytics/customer/${CUSTOMER_A}/dashboard`,
      { headers: headers('customer', CUSTOMER_A) },
    );
    expect(ok.status).toBe(200);
  });
});

describe('Batch 1 F06 — vendor bank accounts ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
  });

  function build() {
    return roleApp(registerVendorBankAccountEndpoints);
  }

  it('GET bank-accounts: cross-vendor denied before query', async () => {
    const res = await build().request(`http://localhost/vendor/${VENDOR_B}/bank-accounts`, {
      headers: headers('vendor', VENDOR_A),
    });
    expect(res.status).toBe(403);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('POST bank-accounts: customer denied; owning vendor reaches insert path', async () => {
    const cust = await build().request(`http://localhost/vendor/${VENDOR_A}/bank-accounts`, {
      method: 'POST',
      headers: headers('customer', CUSTOMER_A),
      body: JSON.stringify({
        accountHolderName: 'A',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
      }),
    });
    expect(cust.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();

    mockedSelect.mockResolvedValue([{ id: VENDOR_A }] as any);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    mockedInsert.mockResolvedValue([{ id: 'acc-1' }] as any);
    const ok = await build().request(`http://localhost/vendor/${VENDOR_A}/bank-accounts`, {
      method: 'POST',
      headers: headers('vendor', VENDOR_A),
      body: JSON.stringify({
        accountHolderName: 'A',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
      }),
    });
    // May be 200 or fail later on schema — must not be auth denial
    expect(ok.status).not.toBe(403);
    expect(ok.status).not.toBe(401);
  });

  it('DELETE bank-accounts: cross-vendor denied', async () => {
    const res = await build().request(
      `http://localhost/vendor/${VENDOR_B}/bank-accounts/acc-1`,
      {
        method: 'DELETE',
        headers: headers('vendor', VENDOR_A),
      },
    );
    expect(res.status).toBe(403);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe('Batch 1 F06 — POST /settlements/request behavioral authz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
  });

  function build() {
    return roleApp(registerSettlementEndpoints);
  }

  it('denies customer before bank SELECT / payout mutation', async () => {
    const res = await build().request('http://localhost/settlements/request', {
      method: 'POST',
      headers: headers('customer', CUSTOMER_A),
      body: JSON.stringify({ vendorId: VENDOR_A, amount: 500 }),
    });
    expect(res.status).toBe(403);
    expect(bankSelectOccurred()).toBe(false);
    assertNoBankOrPayoutMutation();
  });

  it('denies cross-vendor forged body vendorId before bank SELECT', async () => {
    const res = await build().request('http://localhost/settlements/request', {
      method: 'POST',
      headers: headers('vendor', VENDOR_A),
      body: JSON.stringify({ vendorId: VENDOR_B, amount: 500 }),
    });
    expect(res.status).toBe(403);
    expect(bankSelectOccurred()).toBe(false);
    assertNoBankOrPayoutMutation();
  });

  it('authorized vendor reaches bank lookup (authz passed)', async () => {
    mockedQuery.mockImplementation(async (sql: any) => {
      const s = String(sql || '');
      if (/information_schema\.tables/i.test(s) && /vendor_bank_accounts/i.test(s)) {
        return { rows: [{ ex: true }], rowCount: 1 } as any;
      }
      if (/FROM vendor_bank_accounts/i.test(s)) {
        return {
          rows: [
            {
              account_number: '123456789012',
              ifsc_code: 'HDFC0001234',
              is_verified: true,
              is_primary: true,
            },
          ],
          rowCount: 1,
        } as any;
      }
      if (/FROM settlements/i.test(s)) return { rows: [{ pending: '1000' }], rowCount: 1 } as any;
      if (/FROM vendor_earnings/i.test(s)) return { rows: [{ pending: '0' }], rowCount: 1 } as any;
      if (/FROM payouts/i.test(s)) return { rows: [{ held: '0' }], rowCount: 1 } as any;
      if (/pg_try_advisory_lock/i.test(s)) return { rows: [{ ok: false }], rowCount: 1 } as any;
      return { rows: [], rowCount: 0 } as any;
    });

    const res = await build().request('http://localhost/settlements/request', {
      method: 'POST',
      headers: headers('vendor', VENDOR_A),
      body: JSON.stringify({ vendorId: VENDOR_A, amount: 500 }),
    });
    // Authz must have passed — bank account query executed for own vendor.
    expect(bankSelectOccurred()).toBe(true);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('admin may act for a vendorId (explicit policy)', async () => {
    mockedQuery.mockImplementation(async (sql: any) => {
      const s = String(sql || '');
      if (/information_schema\.tables/i.test(s)) {
        return { rows: [{ ex: false }], rowCount: 1 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });
    mockedSelect.mockResolvedValue([] as any);
    const res = await build().request('http://localhost/settlements/request', {
      method: 'POST',
      headers: headers('admin', 'admin-1'),
      body: JSON.stringify({ vendorId: VENDOR_B, amount: 500 }),
    });
    // Admin bypasses vendor match; may fail later on missing bank — not 403 authz.
    expect(res.status).not.toBe(403);
  });
});

describe('Batch 1 F06 — bank-details behavioral authz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockImplementation(async (id: string) => id);
    mockedResolveVendorIds.mockImplementation(async (id: string) => [id]);
  });

  function build() {
    return roleApp(registerSettlementEndpoints);
  }

  const bankPayload = {
    accountNumber: '123456789012',
    ifscCode: 'HDFC0001234',
    accountHolderName: 'Vendor A',
    bankName: 'HDFC',
  };

  it('GET: cross-vendor denied before bank SELECT / disclosure', async () => {
    const res = await build().request(`http://localhost/vendor/${VENDOR_B}/bank-details`, {
      headers: headers('vendor', VENDOR_A),
    });
    expect(res.status).toBe(403);
    expect(bankSelectOccurred()).toBe(false);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/account_number|ifsc|123456789012/i);
  });

  it('PUT: cross-vendor denied before update', async () => {
    const res = await build().request(`http://localhost/vendor/${VENDOR_B}/bank-details`, {
      method: 'PUT',
      headers: headers('vendor', VENDOR_A),
      body: JSON.stringify(bankPayload),
    });
    expect(res.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('POST: customer denied before create', async () => {
    const res = await build().request(`http://localhost/vendor/${VENDOR_A}/bank-details`, {
      method: 'POST',
      headers: headers('customer', CUSTOMER_A),
      body: JSON.stringify(bankPayload),
    });
    expect(res.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('POST: forged path vendor denied', async () => {
    const res = await build().request(`http://localhost/vendor/${VENDOR_B}/bank-details`, {
      method: 'POST',
      headers: headers('vendor', VENDOR_A),
      body: JSON.stringify(bankPayload),
    });
    expect(res.status).toBe(403);
    expect(mockedInsert).not.toHaveBeenCalled();
  });

  it('GET: authorized vendor may proceed past authz', async () => {
    mockedQuery.mockImplementation(async (sql: any) => {
      const s = String(sql || '');
      if (/information_schema\.tables/i.test(s)) {
        return { rows: [{ table_exists: false }], rowCount: 1 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });
    mockedSelect.mockResolvedValue([] as any);
    const res = await build().request(`http://localhost/vendor/${VENDOR_A}/bank-details`, {
      headers: headers('vendor', VENDOR_A),
    });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('PUT: admin may access any vendor path (explicit policy)', async () => {
    // resolveOrCreate may hit selects — authz must not 403
    mockedSelect.mockResolvedValue([{ id: VENDOR_B }] as any);
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const res = await build().request(`http://localhost/vendor/${VENDOR_B}/bank-details`, {
      method: 'PUT',
      headers: headers('admin', 'admin-1'),
      body: JSON.stringify(bankPayload),
    });
    expect(res.status).not.toBe(403);
  });
});

describe('Batch 1 F07 — residual GET mutations left unchanged (contract risk)', () => {
  it('documents vendor profile GET auto-create / role_id backfill still present', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../endpoints/vendor/endpoints/vendorProfile.vendor.ts'),
      'utf8',
    );
    expect(src).toMatch(/app\.get\("\/vendor\/profile"/);
    expect(src).toMatch(/AUTO-CREATE VENDORS RECORD/);
    expect(src).toMatch(/Updated vendor record with role_id/);
  });

  it('documents customer unified-profile GET onboarding persistence still present', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '../../endpoints/customer/profile/services/customer_profile_unified_identifier_get.service.ts',
      ),
      'utf8',
    );
    expect(src).toMatch(/Persist so we don't infer every time/);
    expect(src).toMatch(/dbCustomerProfileUnifiedIdentifierGet5/);
  });
});

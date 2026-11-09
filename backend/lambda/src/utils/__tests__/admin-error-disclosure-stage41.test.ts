/**
 * Stage 4.1 Batch 1 — Admin error disclosure remediation regression.
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

jest.mock('../payments/razorpay-client', () => ({
  getRazorpayClient: jest.fn(),
  resolveRazorpayPayoutSourceAccountNumber: jest.fn(),
}));

jest.mock('../vendor-bank-for-payout', () => ({
  fetchVendorBankRowsForPayout: jest.fn(async () => []),
}));

jest.mock('../settlement-schedule-eventbridge', () => ({
  putSettlementCalculateDailyCron: jest.fn(),
  resolveSettlementCalculateCronRuleName: jest.fn(() => 'rule'),
  scheduleTimeAndZoneToUtcCron: jest.fn(() => '0 0 * * ? *'),
}));

jest.mock('../admin-rbac-permissions', () => ({
  canManageRbacAdmin: jest.fn(async () => true),
  isMasterAdminEmail: jest.fn(() => false),
  MASTER_ADMIN_ID: '00000000-0000-4000-8000-000000000001',
  resolveAdminPermissions: jest.fn(async () => ({})),
}));

import { query } from '../../database/rds-connection';
import { registerAdminAdvancedEndpoints } from '../../endpoints/admin/endpoints/admin-advanced';
import { registerAdminComprehensiveEndpoints } from '../../endpoints/admin/endpoints/admin-comprehensive';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const srcRoot = path.join(__dirname, '../..');

function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

const adminFiles = [
  'endpoints/admin/endpoints/admin-advanced.ts',
  'endpoints/admin/endpoints/admin-comprehensive.ts',
  'endpoints/admin-comprehensive.ts',
];

function assertNoSensitiveLeak(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED|AccessDenied|stackTrace|at Object\./i);
  expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|aws_secret|client_secret=/i);
  expect((body as any)?.stack).toBeUndefined();
}

describe('Stage 4.1 Admin — source contracts', () => {
  it.each(adminFiles)('%s imports SAFE_INTERNAL_ERROR_MESSAGE', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/from ['"].*safe-hono-error['"]/);
  });

  it.each(adminFiles)('%s does not return raw error.message on 500', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message\s*\},\s*500\)/);
    expect(src).not.toMatch(
      /return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message\s*\},\s*500\)/,
    );
    expect(src).not.toMatch(/return this\.error\(\s*error\.message\s*,\s*500\s*\)/);
    expect(src).not.toMatch(/return this\.error\(\s*error\.message\s*\|\|[^,]+,\s*500\s*\)/);
  });

  it('admin-advanced does not echo createSafeErrorResponse.message to clients', () => {
    const src = read('endpoints/admin/endpoints/admin-advanced.ts');
    expect(src).not.toMatch(/error:\s*errorResponse\.error/);
    expect(src).toMatch(/error:\s*SAFE_INTERNAL_ERROR_MESSAGE/);
  });

  it('admin-advanced health and payout catches use SAFE_INTERNAL', () => {
    const src = read('endpoints/admin/endpoints/admin-advanced.ts');
    expect(src).toMatch(/Admin health check failed[\s\S]{0,200}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/Error updating payout:[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/Error deleting payout:[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/Error processing payout:[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).not.toMatch(/razorpayMessage:/);
  });

  it('vendor document handlers preserve intentional 4xx and sanitize 500', () => {
    const nested = read('endpoints/admin/endpoints/admin-comprehensive.ts');
    const root = read('endpoints/admin-comprehensive.ts');
    for (const src of [nested, root]) {
      expect(src).toMatch(/return c\.json\(\{\s*error:\s*['"]Vendor not found['"]\s*\},\s*404\)/);
      expect(src).toMatch(/return c\.json\(\{\s*error:\s*['"]No files provided['"]\s*\},\s*400\)/);
      expect(src).toMatch(/return c\.json\(\{\s*error:\s*['"]All uploads failed['"]\s*\},\s*400\)/);
      expect(src).toMatch(
        /UpdateVendorDocuments[\s\S]{0,1200}return c\.json\(\{\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\},\s*500\)/,
      );
    }
  });

  it('intentional auth validation messages remain in comprehensive login', () => {
    const src = read('endpoints/admin/endpoints/admin-comprehensive.ts');
    expect(src).toMatch(/this\.error\('Email and password are required',\s*400\)/);
    expect(src).toMatch(/this\.error\('Invalid credentials',\s*401\)/);
    expect(src).toMatch(/this\.error\('Admin already exists',\s*409\)/);
    expect(src).toMatch(/this\.error\('Authentication required',\s*401\)/);
  });
});

describe('Stage 4.1 Admin — runtime unexpected 5xx sanitization', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('GET /health returns generic message when DB throws (no PG/AWS leak)', async () => {
    mockedQuery.mockRejectedValueOnce(
      Object.assign(new Error('relation "admins" does not exist'), {
        code: '42P01',
        stack: 'Error: relation "admins" does not exist\n    at Object.query',
      }),
    );

    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.status).toBe('unhealthy');
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('GET /admin/platform/feature-flags returns SAFE_INTERNAL on unexpected failure', async () => {
    mockedQuery.mockRejectedValueOnce(
      new Error('AWS Secrets Manager AccessDeniedException: User is not authorized'),
    );
    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const res = await app.request('http://localhost/admin/platform/feature-flags');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('PUT /admin/payouts/:id returns SAFE_INTERNAL on unexpected failure', async () => {
    mockedQuery.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "payouts_pkey"'),
    );
    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const id = '11111111-1111-4111-8111-111111111111';
    const res = await app.request(`http://localhost/admin/payouts/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Admin — business validation preserved', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('POST /admin/auth/login returns 400 for missing credentials', async () => {
    const app = new Hono();
    registerAdminComprehensiveEndpoints(app);
    const res = await app.request('http://localhost/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Email and password are required');
    assertNoSensitiveLeak(body);
  });

  it('POST /admin/auth/login returns 401 for unknown admin', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    const app = new Hono();
    registerAdminComprehensiveEndpoints(app);
    const res = await app.request('http://localhost/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Invalid credentials');
    assertNoSensitiveLeak(body);
  });

  it('GET /admin/auth/me returns 401 without Authorization', async () => {
    const app = new Hono();
    registerAdminComprehensiveEndpoints(app);
    const res = await app.request('http://localhost/admin/auth/me');
    expect([401, 403]).toContain(res.status);
    const body = (await res.json()) as any;
    expect(body.error).toBeTruthy();
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('catalog product create maps FK failures to intentional 400', async () => {
    const { insert } = require('../../database/rds-connection');
    const categoryId = '22222222-2222-4222-8222-222222222222';
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: categoryId }], rowCount: 1 } as any);
    (insert as jest.Mock).mockRejectedValueOnce(
      new Error('insert or update on table "products" violates foreign key constraint "products_category_id_fkey"'),
    );
    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const res = await app.request('http://localhost/admin/catalog/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test', price: 10, categoryId }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/Invalid category selected/i);
    assertNoSensitiveLeak(body);
  });

  it('POST /admin/payouts/:id/process returns 400 for invalid payout id', async () => {
    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const res = await app.request('http://localhost/admin/payouts/not-a-uuid/process', {
      method: 'POST',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Invalid payout ID');
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Admin — authorization regression surface', () => {
  it('RBAC create user still requires canManageRbacAdmin (403 when denied)', async () => {
    const { canManageRbacAdmin } = require('../admin-rbac-permissions');
    (canManageRbacAdmin as jest.Mock).mockResolvedValueOnce(false);
    const app = new Hono();
    registerAdminAdvancedEndpoints(app);
    const res = await app.request('http://localhost/admin/rbac/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', name: 'A', roleIds: [] }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/RBAC management permission required/i);
    assertNoSensitiveLeak(body);
  });
});

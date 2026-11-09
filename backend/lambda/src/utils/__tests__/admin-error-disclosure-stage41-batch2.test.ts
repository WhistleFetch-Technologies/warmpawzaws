/**
 * Stage 4.1 Batch 2 — Admin error disclosure remediation regression.
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

jest.mock('../aws/secrets-manager', () => ({
  getSecret: jest.fn(),
  getSecretJson: jest.fn(),
  putSecret: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  ListBucketsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetCallerIdentityCommand: jest.fn(),
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
}));

jest.mock('../../endpoints/customer/password', () => ({}), { virtual: true });

import { query, select } from '../../database/rds-connection';
import { getSecret } from '../aws/secrets-manager';
import { registerAnalyticsEndpoints } from '../../endpoints/admin/endpoints/analytics.admin';
import { registerAdminIntegrationEndpoints } from '../../endpoints/admin/endpoints/admin-integrations';
import { registerAdminCustomerEndpoints } from '../../endpoints/admin/endpoints/admin-customer-endpoints';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;
const mockedGetSecret = getSecret as jest.MockedFunction<typeof getSecret>;
const srcRoot = path.join(__dirname, '../..');

function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

const batch2Files = [
  'endpoints/admin/endpoints/analytics.admin.ts',
  'endpoints/admin/endpoints/admin-integrations.ts',
  'endpoints/admin/endpoints/admin-customer-endpoints.ts',
  'endpoints/admin/endpoints/admin.controller.ts',
];

function assertNoSensitiveLeak(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED|AccessDenied|stackTrace|at Object\./i);
  expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|Secrets Manager|aws_secret/i);
  expect((body as any)?.stack).toBeUndefined();
  if ((body as any)?.details != null) {
    expect(String((body as any).details)).not.toMatch(/AccessDenied|TimeoutError|Credentials/i);
  }
}

describe('Stage 4.1 Batch 2 — source contracts', () => {
  it.each(batch2Files)('%s imports SAFE_INTERNAL_ERROR_MESSAGE', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/from ['"].*safe-hono-error['"]/);
  });

  it.each(batch2Files)('%s does not return raw error.message on unexpected 500', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message\s*\},\s*500\)/);
    expect(src).not.toMatch(
      /return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message/,
    );
    expect(src).not.toMatch(/return this\.error\(\s*error\.message/);
  });

  it('integrations google-maps catch no longer exposes details/error.name', () => {
    const src = read('endpoints/admin/endpoints/admin-integrations.ts');
    expect(src).not.toMatch(/details:\s*error\.name/);
    expect(src).not.toMatch(/Secrets Manager configuration/);
    expect(src).toMatch(
      /Error fetching Google Maps config:[\s\S]{0,300}SAFE_INTERNAL_ERROR_MESSAGE/,
    );
  });

  it('admin.controller preserves intentional vendor validation errors', () => {
    const src = read('endpoints/admin/endpoints/admin.controller.ts');
    expect(src).toMatch(/this\.error\('Vendor ID is required',\s*400\)/);
    expect(src).toMatch(/this\.error\('Vendor not found',\s*404\)/);
    expect(src).toMatch(/this\.error\('Rejection reason is required',\s*400\)/);
  });
});

describe('Stage 4.1 Batch 2 — analytics runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSelect.mockReset();
  });

  it('GET /analytics/platform/overview unexpected failure is sanitized', async () => {
    mockedQuery.mockRejectedValueOnce(
      new Error('relation "bookings" does not exist'),
    );
    const app = new Hono();
    registerAnalyticsEndpoints(app);
    const res = await app.request('http://localhost/analytics/platform/overview');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('GET /analytics/vendor/:id/dashboard unexpected failure is sanitized', async () => {
    mockedSelect.mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }] as any);
    mockedQuery.mockRejectedValueOnce(new Error('column "xyz" does not exist'));
    const app = new Hono();
    registerAnalyticsEndpoints(app);
    const res = await app.request(
      'http://localhost/analytics/vendor/11111111-1111-4111-8111-111111111111/dashboard',
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('GET /admin/analytics/overview without auth remains 401 business denial', async () => {
    const app = new Hono();
    registerAnalyticsEndpoints(app);
    const res = await app.request('http://localhost/admin/analytics/overview');
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBeTruthy();
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Batch 2 — integrations runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSelect.mockReset();
    mockedGetSecret.mockReset();
  });

  it('GET /config/google-maps-key does not disclose Secrets Manager internals', async () => {
    const prevKey = process.env.GOOGLE_MAPS_API_KEY;
    const prevMap = process.env.GOOGLE_MAPS_MAP_ID;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_MAP_ID;
    mockedSelect.mockResolvedValue([] as any);
    mockedGetSecret.mockRejectedValue(
      Object.assign(
        new Error(
          'User: arn:aws:iam::123:user/x is not authorized to perform: secretsmanager:GetSecretValue',
        ),
        { name: 'AccessDeniedException' },
      ),
    );
    try {
      const app = new Hono();
      registerAdminIntegrationEndpoints(app);
      const res = await app.request('http://localhost/config/google-maps-key');
      const body = (await res.json()) as any;
      // Secrets Manager failures are swallowed into "not configured" (404) or outer SAFE 5xx.
      expect([404, 500, 503]).toContain(res.status);
      if (res.status === 404) {
        expect(body.error).toMatch(/not configured/i);
      } else {
        expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
      }
      expect(body.details).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/secretsmanager|AccessDenied|arn:aws:iam/i);
      assertNoSensitiveLeak(body);
    } finally {
      if (prevKey !== undefined) process.env.GOOGLE_MAPS_API_KEY = prevKey;
      if (prevMap !== undefined) process.env.GOOGLE_MAPS_MAP_ID = prevMap;
    }
  });

  it('POST /verify/gst missing number remains intentional 400', async () => {
    const app = new Hono();
    registerAdminIntegrationEndpoints(app);
    const res = await app.request('http://localhost/verify/gst', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/GST number is required/i);
  });

  it('POST /verify/gst unexpected failure is sanitized', async () => {
    const app = new Hono();
    registerAdminIntegrationEndpoints(app);
    const res = await app.request('http://localhost/verify/gst', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    });
    // invalid JSON may throw into catch → 500 sanitized, or parse path; accept sanitized 500
    if (res.status === 500) {
      const body = (await res.json()) as any;
      expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
      assertNoSensitiveLeak(body);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('POST /verify/bank unexpected failure is sanitized', async () => {
    const { validateBankAccountStrict } = require('../../endpoints/razorpay/endpoints/razorpay.razorpay');
    (validateBankAccountStrict as jest.Mock).mockRejectedValueOnce(
      new Error('Razorpay fund account validation HTTP 500: internal'),
    );
    const app = new Hono();
    registerAdminIntegrationEndpoints(app);
    const res = await app.request('http://localhost/verify/bank', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountNumber: '1234567890',
        ifsc: 'HDFC0001234',
        accountHolderName: 'Test',
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('POST /admin/integrations/aws/test nested failure is sanitized', async () => {
    const { STSClient } = require('@aws-sdk/client-sts');
    STSClient.mockImplementation(() => ({
      send: jest.fn().mockRejectedValue(new Error('The security token included in the request is invalid')),
    }));
    const app = new Hono();
    registerAdminIntegrationEndpoints(app);
    const res = await app.request('http://localhost/admin/integrations/aws/test', {
      method: 'POST',
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Batch 2 — customer admin runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('GET /admin/customers without auth remains denied', async () => {
    const app = new Hono();
    registerAdminCustomerEndpoints(app);
    const res = await app.request('http://localhost/admin/customers');
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBeTruthy();
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it('source contract: customer deactivate/delete catches use SAFE_INTERNAL', () => {
    const src = read('endpoints/admin/endpoints/admin-customer-endpoints.ts');
    expect(src).toMatch(/customers\/:customerId\/deactivate[\s\S]{0,800}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/customers\/:customerId\/delete[\s\S]{0,800}SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/customers\/:customerId\/details[\s\S]{0,1200}SAFE_INTERNAL_ERROR_MESSAGE/);
  });
});

describe('Stage 4.1 Batch 2 — admin.controller contracts', () => {
  it('vendor list/stats/approve unexpected paths use SAFE_INTERNAL', () => {
    const src = read('endpoints/admin/endpoints/admin.controller.ts');
    expect(src).toMatch(/this\.error\(SAFE_INTERNAL_ERROR_MESSAGE,\s*500\)/);
    expect(src).toMatch(
      /approve[\s\S]{0,2000}return c\.json\(\{\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\},\s*500\)/i,
    );
    expect(src).toMatch(
      /reject[\s\S]{0,2000}return c\.json\(\{\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\},\s*500\)/i,
    );
    expect(src).toMatch(/this\.error\('Vendor not found',\s*404\)/);
  });
});

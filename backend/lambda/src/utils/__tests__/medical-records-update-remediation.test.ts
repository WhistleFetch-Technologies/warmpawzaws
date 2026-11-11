/**
 * Medical-records UPDATE remediation (migration 1131) — local regression tests.
 *
 * Validates:
 * - Migration SQL scope (drop broken medical immutability objects only)
 * - PUT /medical-records/:recordId authz + update behaviour with mocked DB
 * - Doctor booking prescription upsert UPDATE path
 *
 * Does not execute DDL/DML against DEV/prod.
 */
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';

const CUSTOMER_A = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_B = '22222222-2222-4222-8222-222222222222';
const RECORD_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECORD_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BOOKING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VENDOR_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PET_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const query = jest.fn();
const select = jest.fn();
const insert = jest.fn();
const update = jest.fn();

jest.mock('../../database/rds-connection', () => ({
  query: (...args: unknown[]) => query(...args),
  select: (...args: unknown[]) => select(...args),
  insert: (...args: unknown[]) => insert(...args),
  update: (...args: unknown[]) => update(...args),
}));

jest.mock('../customer-id-from-auth', () => ({
  authHeadersFromHonoRequest: jest.fn(() => ({})),
  resolveCustomerIdFromHonoContext: jest.fn(async (c: { get: (k: string) => unknown }) => {
    const id = String(c.get('userId') || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : null;
  }),
}));

jest.mock('../vendor-resolve', () => ({
  resolveVendorId: jest.fn(async (id: string) => id),
  resolveVendorIdsForLedger: jest.fn(async (id: string) => [id]),
}));

jest.mock('../aws/aws-clients', () => ({
  uploadToS3: jest.fn(),
  generateS3Key: jest.fn(() => 'key'),
}));

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

import { registerMedicalRecordsEndpoints } from '../../endpoints/medical-records';

function buildApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    const userId = c.req.header('x-test-user-id');
    const role = c.req.header('x-test-role');
    if (userId) (c as any).set('userId', userId);
    if (role) {
      (c as any).set('userRole', role);
      (c as any).set('userGroups', [role]);
    }
    await next();
  });
  registerMedicalRecordsEndpoints(app);
  return app;
}

describe('migration 1131 medical_records immutability trigger fix', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../../../db/migrations/1131_fix_medical_records_immutability_trigger.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('drops only the broken medical immutability trigger and function', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trigger_prevent_medical_record_updates/i);
    expect(sql).toMatch(/ON public\.medical_records/i);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.prevent_medical_record_updates\s*\(\s*\)/i);
  });

  it('does not touch prescriptions objects or add is_immutable', () => {
    expect(sql).not.toMatch(/prevent_prescription_updates/i);
    expect(sql).not.toMatch(/trigger_prevent_prescription_updates/i);
    expect(sql).not.toMatch(/ADD COLUMN[\s\S]*is_immutable/i);
    expect(sql).not.toMatch(/UPDATE\s+medical_records/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+medical_records/i);
  });

  it('documents preservation of updated_at trigger and forward-fix recovery', () => {
    expect(sql).toMatch(/trigger_update_medical_records_updated_at/i);
    expect(sql).toMatch(/Forward-fix/i);
    expect(sql).not.toMatch(/DROP TRIGGER IF EXISTS trigger_update_medical_records_updated_at/i);
  });
});

describe('PUT /medical-records/:recordId authz and update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows authenticated customer to update their own record and sets updated_at', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: RECORD_A }], rowCount: 1 });
    update.mockResolvedValueOnce([
      { id: RECORD_A, customer_id: CUSTOMER_A, title: 'Updated title' },
    ]);

    const res = await buildApp().request(`http://localhost/medical-records/${RECORD_A}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': CUSTOMER_A,
        'x-test-role': 'customer',
      },
      body: JSON.stringify({ title: 'Updated title' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.recordId).toBe(RECORD_A);
    expect(body.customerId).toBe(CUSTOMER_A);

    expect(query).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      'medical_records',
      { id: RECORD_A },
      expect.objectContaining({
        title: 'Updated title',
        updated_at: expect.any(String),
      }),
    );
    const patch = update.mock.calls[0][2] as { updated_at: string };
    expect(Number.isNaN(Date.parse(patch.updated_at))).toBe(false);
  });

  it('returns 404 for cross-customer update and does not call update', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await buildApp().request(`http://localhost/medical-records/${RECORD_B}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': CUSTOMER_A,
        'x-test-role': 'customer',
      },
      body: JSON.stringify({ title: 'Nope' }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 401 when authentication is missing', async () => {
    const res = await buildApp().request(`http://localhost/medical-records/${RECORD_A}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-role': 'customer' },
      body: JSON.stringify({ title: 'Nope' }),
    });

    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid record UUID', async () => {
    const res = await buildApp().request('http://localhost/medical-records/not-a-uuid', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': CUSTOMER_A,
        'x-test-role': 'customer',
      },
      body: JSON.stringify({ title: 'Nope' }),
    });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('allows admin update without ownership query', async () => {
    update.mockResolvedValueOnce([
      { id: RECORD_B, customer_id: CUSTOMER_B, title: 'Admin edit' },
    ]);

    const res = await buildApp().request(`http://localhost/medical-records/${RECORD_B}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': '99999999-9999-4999-8999-999999999999',
        'x-test-role': 'admin',
      },
      body: JSON.stringify({ title: 'Admin edit' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      'medical_records',
      { id: RECORD_B },
      expect.objectContaining({ title: 'Admin edit', updated_at: expect.any(String) }),
    );
    // Ownership SELECT is skipped for admin
    expect(query).not.toHaveBeenCalled();
  });
});

describe('POST /medical-records/booking/:bookingId/prescription upsert UPDATE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an existing medical_records row for the booking prescription path', async () => {
    select.mockImplementation(async (table: string) => {
      if (table === 'bookings') {
        return [
          {
            id: BOOKING_ID,
            pet_id: PET_ID,
            customer_id: CUSTOMER_A,
            vendor_id: VENDOR_ID,
          },
        ];
      }
      if (table === 'medical_records') {
        return [
          {
            id: RECORD_A,
            booking_id: BOOKING_ID,
            record_type: 'prescription',
          },
        ];
      }
      return [];
    });

    query.mockResolvedValueOnce({
      rows: [
        {
          id: RECORD_A,
          booking_id: BOOKING_ID,
          record_type: 'prescription',
          prescription_date: '2026-01-01T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    });

    update.mockResolvedValueOnce([{ id: RECORD_A }]);

    const res = await buildApp().request(
      `http://localhost/medical-records/booking/${BOOKING_ID}/prescription`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-role': 'vendor',
          'x-test-user-id': VENDOR_ID,
        },
        body: JSON.stringify({
          medications: [{ name: 'Med A' }],
          diagnosis: 'checkup',
          notes: 'follow-up',
          vendorId: VENDOR_ID,
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      'medical_records',
      { id: RECORD_A },
      expect.objectContaining({
        prescription_date: expect.any(String),
        content_data: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(insert).not.toHaveBeenCalled();
  });
});

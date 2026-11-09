/**
 * Security ownership helper unit tests (no DB).
 * Integration-style IDOR matrix lives in security-idor-regression.test.ts
 */
import type { Context } from 'hono';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));
jest.mock('../customer-coordinates', () => ({
  resolveCustomerIdFromPhone: jest.fn(),
}));
jest.mock('../customer-id-from-auth', () => ({
  resolveCustomerIdFromHonoContext: jest.fn(),
}));
jest.mock('../vendor-resolve', () => ({
  resolveVendorId: jest.fn(async (id: string) => id),
  resolveVendorIdsForLedger: jest.fn(async (id: string) => [id]),
}));

import { query } from '../../database/rds-connection';
import { resolveCustomerIdFromPhone } from '../customer-coordinates';
import { resolveCustomerIdFromHonoContext } from '../customer-id-from-auth';
import {
  requireAuthenticatedCustomer,
  requireCustomerPhoneMatch,
  requireCustomerIdentifierMatch,
  requireBookingOwnedByAuthCustomer,
  requirePetOwnedByAuthCustomer,
  requirePathVendorMatchesAuth,
  projectPublicCustomer,
} from '../security-ownership';

const mockedAuth = resolveCustomerIdFromHonoContext as jest.MockedFunction<
  typeof resolveCustomerIdFromHonoContext
>;
const mockedPhone = resolveCustomerIdFromPhone as jest.MockedFunction<
  typeof resolveCustomerIdFromPhone
>;
const mockedQuery = query as jest.MockedFunction<typeof query>;

function fakeContext(overrides: Partial<{ userId: string; userRole: string; userGroups: string[] }> = {}): Context {
  const store: Record<string, unknown> = {
    userId: overrides.userId,
    userRole: overrides.userRole || 'customer',
    userGroups: overrides.userGroups || ['customer'],
  };
  return {
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
  } as unknown as Context;
}

describe('security-ownership helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requireAuthenticatedCustomer returns 401 when JWT customer missing', async () => {
    mockedAuth.mockResolvedValue(null);
    const result = await requireAuthenticatedCustomer(fakeContext());
    expect(result).toEqual({ ok: false, status: 401, error: 'Authentication required' });
  });

  it('requireCustomerPhoneMatch denies mismatched phone (TM5 / spoofed phone)', async () => {
    mockedAuth.mockResolvedValue('cust-a');
    mockedPhone.mockResolvedValue('cust-b');
    const result = await requireCustomerPhoneMatch(fakeContext({ userId: 'cust-a' }), '9999999999');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('requireCustomerPhoneMatch allows matching phone (TM1 own resource)', async () => {
    mockedAuth.mockResolvedValue('cust-a');
    mockedPhone.mockResolvedValue('cust-a');
    const result = await requireCustomerPhoneMatch(fakeContext({ userId: 'cust-a' }), '9876543210');
    expect(result).toEqual({ ok: true, customerId: 'cust-a' });
  });

  it('requireCustomerIdentifierMatch denies other customer UUID', async () => {
    mockedAuth.mockResolvedValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const result = await requireCustomerIdentifierMatch(
      fakeContext(),
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('requireBookingOwnedByAuthCustomer returns opaque 404 for non-owner (TM2)', async () => {
    mockedAuth.mockResolvedValue('cust-a');
    mockedQuery.mockResolvedValue({ rows: [] } as any);
    const result = await requireBookingOwnedByAuthCustomer(
      fakeContext(),
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );
    expect(result).toEqual({ ok: false, status: 404, error: 'Booking not found' });
  });

  it('requirePetOwnedByAuthCustomer denies other pet (TM4)', async () => {
    mockedAuth.mockResolvedValue('cust-a');
    mockedQuery.mockResolvedValue({ rows: [] } as any);
    const result = await requirePetOwnedByAuthCustomer(
      fakeContext(),
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('requirePathVendorMatchesAuth rejects customer role (TM9)', async () => {
    const result = await requirePathVendorMatchesAuth(
      fakeContext({ userId: 'vendor-a', userRole: 'customer', userGroups: ['customer'] }),
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('requirePathVendorMatchesAuth allows matching vendor JWT', async () => {
    const vendorId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const result = await requirePathVendorMatchesAuth(
      fakeContext({ userId: vendorId, userRole: 'vendor', userGroups: ['vendor'] }),
      vendorId,
    );
    expect(result.ok).toBe(true);
  });

  it('projectPublicCustomer strips password_hash', () => {
    const out = projectPublicCustomer({
      id: '1',
      phone: '9876543210',
      password_hash: 'secret',
      passwordHash: 'secret2',
    }) as Record<string, unknown>;
    expect(out.password_hash).toBeUndefined();
    expect(out.passwordHash).toBeUndefined();
    expect(out.phone).toBe('9876543210');
  });
});

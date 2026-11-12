import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const dbFindCustomerLegalAcceptance = jest.fn<any>();
const dbUpsertCustomerLegalAcceptance = jest.fn<any>();
const resolveCustomerIdFromPhone = jest.fn<any>();
const resolveWpayAuthenticatedCustomer = jest.fn<any>();

jest.mock('../../repos/wpay-legal-acceptance.repo', () => ({
  dbFindCustomerLegalAcceptance: (...args: unknown[]) => dbFindCustomerLegalAcceptance(...args),
  dbUpsertCustomerLegalAcceptance: (...args: unknown[]) => dbUpsertCustomerLegalAcceptance(...args),
}));

jest.mock('../../../../../utils/customer-coordinates', () => ({
  resolveCustomerIdFromPhone: (...args: unknown[]) => resolveCustomerIdFromPhone(...args),
}));

jest.mock('../../shared/wpay-authenticated-customer', () => ({
  resolveWpayAuthenticatedCustomer: (...args: unknown[]) => resolveWpayAuthenticatedCustomer(...args),
}));

import { executeCustomerWarmpawzPayLegalAcceptanceGet } from '../customer_warmpawz_pay_legal_acceptance_get.service';
import { executeCustomerWarmpawzPayLegalAcceptancePost } from '../customer_warmpawz_pay_legal_acceptance_post.service';

function mockContext(opts: {
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const json = jest.fn((payload: unknown, status?: number) => ({ payload, status: status ?? 200 }));
  return {
    req: {
      query: (key: string) => opts.query?.[key],
      json: async () => opts.body ?? {},
      header: (key: string) => opts.headers?.[key.toLowerCase()] ?? opts.headers?.[key] ?? undefined,
    },
    json,
  } as any;
}

describe('legal acceptance services', () => {
  beforeEach(() => {
    dbFindCustomerLegalAcceptance.mockReset();
    dbUpsertCustomerLegalAcceptance.mockReset();
    resolveCustomerIdFromPhone.mockReset();
    resolveWpayAuthenticatedCustomer.mockReset();
  });

  it('GET returns accepted=false when no row', async () => {
    resolveCustomerIdFromPhone.mockResolvedValue('cust-1');
    dbFindCustomerLegalAcceptance.mockResolvedValue(null);
    const c = mockContext({ query: { phone: '9845234915' } });
    const res = (await executeCustomerWarmpawzPayLegalAcceptanceGet(c)) as any;
    expect(res.payload).toMatchObject({
      success: true,
      accepted: false,
      policyVersion: 'platform_tos_privacy_v1',
    });
  });

  it('POST records acceptance for authenticated customer', async () => {
    resolveWpayAuthenticatedCustomer.mockResolvedValue({ ok: true, customerId: 'cust-1' });
    dbUpsertCustomerLegalAcceptance.mockResolvedValue({
      id: 'acc-1',
      customer_id: 'cust-1',
      policy_version: 'platform_tos_privacy_v1',
      source: 'warmpawz_pay',
      accepted_at: '2026-11-12T00:00:00.000Z',
    });
    const c = mockContext({
      body: { phone: '9845234915' },
      headers: { 'user-agent': 'test-agent', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = (await executeCustomerWarmpawzPayLegalAcceptancePost(c)) as any;
    expect(dbUpsertCustomerLegalAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        policyVersion: 'platform_tos_privacy_v1',
        source: 'warmpawz_pay',
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      }),
    );
    expect(res.payload).toMatchObject({ success: true, accepted: true });
  });
});

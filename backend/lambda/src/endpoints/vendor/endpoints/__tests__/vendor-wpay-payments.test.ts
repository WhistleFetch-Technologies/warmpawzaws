import { query } from '../../../../database/rds-connection';
import { resolveVendorId, resolveVendorIdsForLedger } from '../../../../utils/vendor-resolve';
import { mapWpaySettlementLedgerStatus } from '../../../customer/warmpawz-pay/shared/accrue-wpay-settlement';

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../../../../utils/vendor-resolve', () => ({
  resolveVendorId: jest.fn(),
  resolveVendorIdsForLedger: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedResolveVendorId = resolveVendorId as jest.MockedFunction<typeof resolveVendorId>;
const mockedResolveVendorIdsForLedger = resolveVendorIdsForLedger as jest.MockedFunction<
  typeof resolveVendorIdsForLedger
>;

describe('mapWpaySettlementLedgerStatus (vendor pay bill)', () => {
  it('maps completed settlement to settled for vendor UI', () => {
    expect(mapWpaySettlementLedgerStatus('completed')).toBe('settled');
  });
});

describe('vendor warmpawz-pay payments route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveVendorId.mockResolvedValue('vendor-1');
    mockedResolveVendorIdsForLedger.mockResolvedValue(['vendor-1']);
  });

  it('requires vendorId', async () => {
    const { registerVendorWpayPaymentsEndpoints } = await import('../vendor-wpay-payments');
    const { Hono } = await import('hono');
    const app = new Hono();
    registerVendorWpayPaymentsEndpoints(app);

    const res = await app.request('/vendor/warmpawz-pay/payments');
    expect(res.status).toBe(400);
  });

  it('returns pay bill rows with flowType', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'settlement-1',
          payment_id: 'pay-1',
          total_amount: 900,
          commission_amount: 45,
          net_amount: 855,
          settlement_status: 'pending',
          settlement_date: '2026-08-04',
          settlement_breakup: {
            quotedAmount: 1000,
            platformWithholdPercent: 5,
            platformWithholdAmount: 45,
          },
          created_at: '2026-08-04T10:00:00.000Z',
          original_amount: 1000,
          paid_amount: 900,
          payment_completed_at: '2026-08-04T10:05:00.000Z',
          customer_name: 'Bindu',
        },
      ],
    } as never);

    const { registerVendorWpayPaymentsEndpoints } = await import('../vendor-wpay-payments');
    const { Hono } = await import('hono');
    const app = new Hono();
    registerVendorWpayPaymentsEndpoints(app);

    const res = await app.request('/vendor/warmpawz-pay/payments?vendorId=11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      payments: Array<{ flowType: string; customerName: string; vendorEarnings: number }>;
    };
    expect(body.success).toBe(true);
    expect(body.payments[0].flowType).toBe('pay_bill');
    expect(body.payments[0].customerName).toBe('Bindu');
    expect(body.payments[0].vendorEarnings).toBe(855);
  });
});

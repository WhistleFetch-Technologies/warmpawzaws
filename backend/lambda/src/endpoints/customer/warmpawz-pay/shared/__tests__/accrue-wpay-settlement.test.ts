import { query } from '../../../../../database/rds-connection';
import {
  accrueWpaySettlement,
  mapWpaySettlementLedgerStatus,
  resolveWpayPlatformWithholdPercent,
} from '../accrue-wpay-settlement';
import type { WpayPaymentRow } from '../../repos/wpay-payment.repo';

jest.mock('../../../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

const basePayment: WpayPaymentRow = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: null,
  amount: 900,
  original_amount: 1000,
  discount_amount: 100,
  payment_status: 'completed',
  razorpay_order_id: 'order-1',
  razorpay_payment_id: 'rzp-1',
  razorpay_signature: 'sig',
  metadata: {
    quotedOriginalAmount: 1000,
    quotedDiscountAmount: 100,
    quotedDiscountPercent: 10,
    appointmentFeeCredit: 0,
  },
  completed_at: '2026-08-04T10:00:00.000Z',
  created_at: '2026-08-04T09:00:00.000Z',
};

describe('accrue-wpay-settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps settlement statuses for vendor earnings UI', () => {
    expect(mapWpaySettlementLedgerStatus('pending')).toBe('pending');
    expect(mapWpaySettlementLedgerStatus('completed')).toBe('settled');
    expect(mapWpaySettlementLedgerStatus('failed')).toBe('cancelled');
  });

  it('computes withhold and inserts settlement row', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-1' }] } as never);

    const result = await accrueWpaySettlement(basePayment);

    expect(result.inserted).toBe(true);
    expect(result.settlementId).toBe('settlement-1');
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    const insertArgs = mockedQuery.mock.calls[2]?.[1];
    expect(insertArgs?.[2]).toBeNull();
    expect(insertArgs?.[4]).toBe(45);
    expect(insertArgs?.[5]).toBe(855);
  });

  it('passes booking_id into settlement insert for appointment pay', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-2' }] } as never);

    const result = await accrueWpaySettlement({
      ...basePayment,
      booking_id: 'booking-1',
    });

    expect(result.inserted).toBe(true);
    const insertArgs = mockedQuery.mock.calls[2]?.[1];
    expect(insertArgs?.[2]).toBe('booking-1');
  });

  it('is idempotent when settlement already exists', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-settlement' }] } as never);

    const result = await accrueWpaySettlement(basePayment);

    expect(result.inserted).toBe(false);
    expect(result.settlementId).toBe('existing-settlement');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('clamps withhold percent to 0-100', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '150' }] } as never);

    await expect(resolveWpayPlatformWithholdPercent('vendor-1')).resolves.toBe(100);
  });
});

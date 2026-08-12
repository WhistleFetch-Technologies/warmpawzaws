/**
 * Refundable paid base: must include wallet debits for split / wallet-first bookings.
 */

import {
  getRefundableCustomerPaidBreakdown,
  hasCustomerPaidCapture,
  resolvePaymentCapturableGross,
} from '../refundable-base';
import { query } from '../../../database/rds-connection';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('resolvePaymentCapturableGross', () => {
  it('prefers total_amount when present (Anannya tax-inclusive capture)', () => {
    expect(
      resolvePaymentCapturableGross({
        amount: 1699,
        total_amount: 2004.82,
        gst_amount: 305.82,
      })
    ).toBe(2004.82);
  });

  it('adds gst when total_amount missing and amount is tax-exclusive', () => {
    expect(
      resolvePaymentCapturableGross({
        amount: 1699,
        total_amount: 0,
        gst_amount: 305.82,
      })
    ).toBe(2004.82);
  });

  it('does not invent GST when neither total nor gst present', () => {
    expect(resolvePaymentCapturableGross({ amount: 500 })).toBe(500);
  });
});

describe('getRefundableCustomerPaidBreakdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sums Razorpay completed captures and wallet debits for the booking', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM payments') && sql.includes('payment_status = \'completed\'')) {
        return {
          rows: [
            {
              paid_total: '300',
              platform_fee_total: '0',
              refundable_from_payments: '300',
            },
          ],
        } as any;
      }
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '200' }] } as any;
      }
      return { rows: [] } as any;
    });

    const r = await getRefundableCustomerPaidBreakdown('00000000-0000-4000-8000-000000000001', {
      total_amount: 500,
      discount_amount: 0,
    });
    expect(r.refundableBase).toBe(500);
    expect(r.platformFeeNonRefundable).toBe(0);
  });

  it('excludes both platform and convenience fees from the refundable base', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (
        sql.includes('FROM payments') &&
        sql.includes("payment_method, '')) = 'wallet'")
      ) {
        return { rows: [{ w: '0' }] } as any;
      }
      if (sql.includes('FROM payments') && sql.includes('payment_status = \'completed\'')) {
        expect(sql).toContain('COALESCE(convenience_fee, 0)');
        expect(sql).toContain('total_amount');
        return {
          rows: [
            {
              paid_total: '1000',
              platform_fee_total: '20',
              convenience_fee_total: '30',
              refundable_from_payments: '950',
            },
          ],
        } as any;
      }
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '0' }] } as any;
      }
      return { rows: [] } as any;
    });

    const r = await getRefundableCustomerPaidBreakdown('00000000-0000-4000-8000-000000000004', {
      total_amount: 1000,
      discount_amount: 0,
    });
    expect(r.refundableBase).toBe(950);
    expect(r.platformFeeNonRefundable).toBe(20);
    expect(r.convenienceFeeNonRefundable).toBe(30);
    expect(r.nonRefundableFees).toBe(50);
  });

  it('includes GST in refundable base and still excludes platform/convenience fees', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (
        sql.includes('FROM payments') &&
        sql.includes("payment_method, '')) = 'wallet'")
      ) {
        return { rows: [{ w: '0' }] } as any;
      }
      if (sql.includes('FROM payments') && sql.includes('payment_status = \'completed\'')) {
        return {
          rows: [
            {
              paid_total: '2044.82',
              platform_fee_total: '40',
              convenience_fee_total: '0',
              refundable_from_payments: '2004.82',
            },
          ],
        } as any;
      }
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '0' }] } as any;
      }
      return { rows: [] } as any;
    });

    const r = await getRefundableCustomerPaidBreakdown('00000000-0000-4000-8000-000000000005', {
      total_amount: 2044.82,
      discount_amount: 0,
    });
    expect(r.refundableBase).toBe(2004.82);
    expect(r.platformFeeNonRefundable).toBe(40);
    expect(r.nonRefundableFees).toBe(40);
  });

  it('does not double-count wallet-only bookings (payment row + wallet debit)', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (
        sql.includes('FROM payments') &&
        sql.includes("payment_method, '')) = 'wallet'")
      ) {
        return { rows: [{ w: '500' }] } as any;
      }
      if (sql.includes('FROM payments') && sql.includes('payment_status = \'completed\'')) {
        return {
          rows: [
            {
              paid_total: '500',
              platform_fee_total: '0',
              refundable_from_payments: '500',
            },
          ],
        } as any;
      }
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '500' }] } as any;
      }
      return { rows: [] } as any;
    });

    const r = await getRefundableCustomerPaidBreakdown('00000000-0000-4000-8000-000000000003', {
      total_amount: 500,
      discount_amount: 0,
    });
    expect(r.refundableBase).toBe(500);
  });

  it('uses wallet-only debits when there is no completed payment row', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM payments') && sql.includes('payment_status = \'completed\'')) {
        return {
          rows: [
            {
              paid_total: '0',
              platform_fee_total: '0',
              refundable_from_payments: '0',
            },
          ],
        } as any;
      }
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '150' }] } as any;
      }
      return { rows: [] } as any;
    });

    const r = await getRefundableCustomerPaidBreakdown('00000000-0000-4000-8000-000000000002', {
      total_amount: 150,
      discount_amount: 0,
    });
    expect(r.refundableBase).toBe(150);
  });
});

describe('hasCustomerPaidCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is true when booking snapshot payment_status is completed', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);
    const ok = await hasCustomerPaidCapture('00000000-0000-4000-8000-000000000099', {
      payment_status: 'completed',
    });
    expect(ok).toBe(true);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('is true when wallet_transactions show a debit for the booking', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '25' }] } as any;
      }
      return { rows: [] } as any;
    });
    const ok = await hasCustomerPaidCapture('00000000-0000-4000-8000-000000000088', {
      payment_status: 'pending_payment',
    });
    expect(ok).toBe(true);
  });

  it('is false when no paid status, wallet, or completed payment', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('wallet_transactions')) {
        return { rows: [{ w: '0' }] } as any;
      }
      return { rows: [] } as any;
    });
    const ok = await hasCustomerPaidCapture('00000000-0000-4000-8000-000000000077', {
      payment_status: 'pending_payment',
    });
    expect(ok).toBe(false);
  });
});

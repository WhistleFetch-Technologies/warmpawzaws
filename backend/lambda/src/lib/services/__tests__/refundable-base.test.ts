/**
 * Refundable paid base: must include wallet debits for split / wallet-first bookings.
 */

import { getRefundableCustomerPaidBreakdown, hasCustomerPaidCapture } from '../refundable-base';
import { query } from '../../../database/rds-connection';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

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

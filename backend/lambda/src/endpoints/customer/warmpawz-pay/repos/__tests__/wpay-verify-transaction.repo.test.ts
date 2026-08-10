import { WpayCreditConsumeConflictError } from '../wpay-verify-transaction.repo';

jest.mock('../../../../../database/rds-connection', () => ({
  withTransaction: jest.fn(async (callback: (client: unknown) => Promise<unknown>) => {
    const client = {
      query: jest.fn(),
    };
    return callback(client);
  }),
}));

import { dbWpayAtomicCompleteVerify } from '../wpay-verify-transaction.repo';
import { withTransaction } from '../../../../../database/rds-connection';

describe('wpay-verify-transaction.repo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects credit consume when another payment already owns the booking credit', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ payment_id: 'other-payment' }] }),
    };
    (withTransaction as jest.Mock).mockImplementation(async (cb: (c: typeof client) => Promise<unknown>) =>
      cb(client),
    );

    await expect(
      dbWpayAtomicCompleteVerify({
        paymentId: 'pay-1',
        customerId: 'cust-1',
        razorpayPaymentId: 'rzp-1',
        razorpaySignature: 'sig',
        originalAmount: 1000,
        discountAmount: 0,
        bookingId: 'booking-1',
        creditAmount: 200,
      }),
    ).rejects.toBeInstanceOf(WpayCreditConsumeConflictError);
  });

  it('consumes appointment credit without updating bookings.status', async () => {
    const completedPayment = {
      id: 'pay-1',
      customer_id: 'cust-1',
      vendor_id: 'vendor-1',
      booking_id: 'booking-1',
      amount: 800,
      original_amount: 1000,
      discount_amount: 0,
      payment_status: 'completed',
      razorpay_order_id: 'order-1',
      razorpay_payment_id: 'rzp-1',
      razorpay_signature: 'sig',
      metadata: {},
      completed_at: '2026-08-04T10:00:00.000Z',
      created_at: '2026-08-04T09:00:00.000Z',
    };
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ booking_id: 'booking-1' }] })
        .mockResolvedValueOnce({ rows: [completedPayment] }),
    };
    (withTransaction as jest.Mock).mockImplementation(async (cb: (c: typeof client) => Promise<unknown>) =>
      cb(client),
    );

    const result = await dbWpayAtomicCompleteVerify({
      paymentId: 'pay-1',
      customerId: 'cust-1',
      razorpayPaymentId: 'rzp-1',
      razorpaySignature: 'sig',
      originalAmount: 1000,
      discountAmount: 0,
      bookingId: 'booking-1',
      creditAmount: 200,
    });

    expect(result?.id).toBe('pay-1');
    expect(client.query).toHaveBeenCalledTimes(2);
    const sqlCalls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes('warmpawz_pay_appointment_credits'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('UPDATE payments'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('UPDATE bookings'))).toBe(false);
  });
});

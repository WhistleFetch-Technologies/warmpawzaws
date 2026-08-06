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
});

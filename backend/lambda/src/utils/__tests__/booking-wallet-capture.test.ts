import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shouldDebitWalletImmediately } from '../booking-wallet-capture';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('shouldDebitWalletImmediately', () => {
  test('debits only when the booking is fully wallet (no Razorpay remainder)', () => {
    expect(shouldDebitWalletImmediately(true)).toBe(true);
    expect(shouldDebitWalletImmediately(false)).toBe(false);
  });
});

describe('split-pay wallet is captured on Razorpay success, not at checkout', () => {
  test('payments/create skips debit unless fully wallet', () => {
    const file = read('src/endpoints/payments-enhanced.ts');
    expect(file).toContain('shouldDebitWalletImmediately(fullyWallet)');
    expect(file).toContain('walletActuallyDebited');
    expect(file).toContain('/payments/release-unpaid-wallet');
    expect(file).toContain('creditNetWalletDebitForAbandonedBooking');
  });

  test('booking create skips split-pay debit', () => {
    const file = read('src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain('chunk > 0 && split.fullyWallet');
  });

  test('create-order only debits wallet-only; verify/finalize debit reserved slice', () => {
    const razorpay = read('src/endpoints/razorpay/endpoints/razorpay.razorpay.ts');
    const finalize = read('src/utils/payments/finalize-captured-payment.ts');
    expect(razorpay).toContain('if (split.fullyWallet)');
    expect(razorpay).toContain('debitReservedWalletForBookingInTransaction');
    expect(razorpay).toContain("idempotencyKey: `rz-verify-wallet-${String(bookingId)}`");
    expect(finalize).toContain('debitReservedWalletForBookingInTransaction');
    expect(finalize).toContain("idempotencyKey: `rz-verify-wallet-${bookingId}`");
  });

  test('hold expiry credits net wallet debit after cancelling unpaid booking', () => {
    const file = read('src/utils/payment-hold.ts');
    expect(file).toContain('creditNetWalletDebitForAbandonedBooking');
    expect(file).toContain('wallet credit after expiry failed');
  });

  test('checkout dismiss/fail asks backend to release unpaid wallet', () => {
    const file = readFileSync(
      join(lambdaRoot, '../../apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx'),
      'utf8'
    );
    expect(file).toContain('/payments/release-unpaid-wallet');
    expect(file).toContain('release-unpaid-wallet after fail');
  });
});

const mockQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>> = jest.fn();
const mockCredit: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>> = jest.fn();

jest.mock('../../database/rds-connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}),
}));

jest.mock('../credit-customer-wallet', () => ({
  creditCustomerWalletForBookingRefund: (...args: unknown[]) => mockCredit(...args),
}));

describe('creditNetWalletDebitForAbandonedBooking', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCredit.mockReset();
  });

  test('credits outstanding debit minus prior refunds', async () => {
    const { creditNetWalletDebitForAbandonedBooking } = await import('../booking-wallet-capture');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '500' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });
    mockCredit.mockResolvedValueOnce({ newBalance: 800 });

    const result = await creditNetWalletDebitForAbandonedBooking({
      customerId: 'cust-1',
      bookingId: 'book-1',
    });

    expect(result.credited).toBe(500);
    expect(mockCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        bookingId: 'book-1',
        refundAmount: 500,
        refundPercentage: 100,
      })
    );
  });

  test('is a no-op when net debit is already zero', async () => {
    const { creditNetWalletDebitForAbandonedBooking } = await import('../booking-wallet-capture');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '200' }] })
      .mockResolvedValueOnce({ rows: [{ total: '200' }] });

    const result = await creditNetWalletDebitForAbandonedBooking({
      customerId: 'cust-1',
      bookingId: 'book-1',
    });

    expect(result.credited).toBe(0);
    expect(mockCredit).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockClientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[] }>>();
const mockRefund = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFulfillWpay = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockNotifyBookingIfNeeded = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(async () => ({ rows: [] })),
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => mockClientQuery(sql, params) }),
}));

jest.mock('../refund-captured-payment', () => ({
  refundCapturedPaymentById: (...args: unknown[]) => mockRefund(...args),
}));

jest.mock('../../../endpoints/customer/warmpawz-pay/shared/fulfill-wpay-captured-payment', () => ({
  fulfillWpayCapturedPayment: (...args: unknown[]) => mockFulfillWpay(...args),
}));

jest.mock('../../notification-idempotency', () => ({
  notifyBookingCreatedIfNeeded: (...args: unknown[]) => mockNotifyBookingIfNeeded(...args),
  notifyShopOrderPaidIfNeeded: jest.fn(async () => undefined),
}));

jest.mock('../../booking-notifications', () => ({ notifyBookingCreated: jest.fn(async () => undefined) }));
jest.mock('../../shop-order-notifications', () => ({ notifyShopOrderPaid: jest.fn(async () => undefined) }));
jest.mock('../../booking-start-otp', () => ({ scheduleBookingStartOtpIfNeeded: jest.fn() }));
jest.mock('../../logistics/trigger-auto-shipment', () => ({ triggerAutoShipment: jest.fn(async () => undefined) }));
jest.mock('../../resolve-ecommerce-commission-rate', () => ({ applyOrderCommissionAudit: jest.fn(async () => undefined) }));
jest.mock('../../write-ecommerce-order-settlement', () => ({
  writeEcommerceOrderSettlementLedgerRow: jest.fn(async () => undefined),
}));
jest.mock('../../credit-customer-wallet', () => ({ creditCustomerWalletForBookingRefund: jest.fn(async () => undefined) }));
jest.mock('../../booking-wallet-capture', () => ({
  debitReservedWalletForBookingInTransaction: jest.fn(async () => undefined),
}));
jest.mock('../../slot-occupancy', () => ({
  acquireSlotOccupancyLock: jest.fn(async () => undefined),
  evaluateSlotAvailability: jest.fn(async () => true),
}));

import { finalizeCapturedPayment } from '../finalize-captured-payment';

const BOOKING_ID = '5b5fd2d3-e326-45c9-9390-0f9c244428f6';

function routeClientQueries(paymentRow: Record<string, unknown>) {
  mockClientQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM payments WHERE razorpay_payment_id')) return { rows: [paymentRow] };
    if (sql.includes('SELECT payment_status FROM payments')) return { rows: [{ payment_status: 'completed' }] };
    if (sql.includes('FROM bookings WHERE id')) {
      return {
        rows: [{ id: BOOKING_ID, status: 'completed', payment_status: 'paid', customer_id: 'cust-1', vendor_id: 'v-1' }],
      };
    }
    if (sql.includes('FROM payments') && sql.includes('booking_id = $1')) return { rows: [{ id: 'original-booking-pay' }] };
    return { rows: [] };
  });
}

describe('finalizeCapturedPayment — Warmpawz Pay capture on an already-paid booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefund.mockResolvedValue({ refundId: 'r1', alreadyProcessed: false });
    mockFulfillWpay.mockResolvedValue(undefined);
    mockNotifyBookingIfNeeded.mockResolvedValue(undefined);
  });

  test('does not refund, does not touch the booking, and fulfills the WPay settlement', async () => {
    routeClientQueries({
      id: 'wpay-pay-1',
      payment_source: 'warmpawz_pay',
      payment_status: 'pending',
      booking_id: BOOKING_ID,
      razorpay_payment_id: 'pay_Tkg2yL1xxukEWU',
    });

    const result = await finalizeCapturedPayment({ source: 'webhook', razorpayPaymentId: 'pay_Tkg2yL1xxukEWU' });

    expect(result).toEqual({ outcome: 'already_final', paymentId: 'wpay-pay-1' });
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockFulfillWpay).toHaveBeenCalledWith({ paymentId: 'wpay-pay-1', razorpayPaymentId: 'pay_Tkg2yL1xxukEWU' });
    const sqls = mockClientQuery.mock.calls.map(([sql]) => sql);
    expect(sqls.some((s) => s.includes('FROM bookings WHERE id'))).toBe(false);
    expect(sqls.some((s) => s.includes('UPDATE bookings'))).toBe(false);
    expect(mockNotifyBookingIfNeeded).not.toHaveBeenCalled();
  });

  test('a real second booking capture is still refunded as duplicate_capture', async () => {
    routeClientQueries({
      id: 'dup-booking-pay',
      payment_source: null,
      payment_status: 'pending',
      booking_id: BOOKING_ID,
      razorpay_payment_id: 'pay_dup',
    });

    const result = await finalizeCapturedPayment({ source: 'webhook', razorpayPaymentId: 'pay_dup' });

    expect(result.outcome).toBe('duplicate_refunded');
    expect(mockRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'dup-booking-pay', reason: 'duplicate_capture' })
    );
    expect(mockFulfillWpay).not.toHaveBeenCalled();
  });
});

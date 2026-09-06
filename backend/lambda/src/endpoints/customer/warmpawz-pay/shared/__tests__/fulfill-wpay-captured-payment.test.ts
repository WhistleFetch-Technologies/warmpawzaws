import { fulfillWpayCapturedPayment, quoteAmountsFromWpayPayment } from '../fulfill-wpay-captured-payment';
import { accrueWpaySettlement } from '../accrue-wpay-settlement';
import { notifyWpayPaymentCompleted } from '../../../../../utils/wpay-notifications';
import { dbWpayCompleteFromCapture, dbWpayPaymentById } from '../../repos/wpay-payment.repo';

jest.mock('../accrue-wpay-settlement', () => ({
  accrueWpaySettlement: jest.fn(),
}));
jest.mock('../../../../../utils/wpay-notifications', () => ({
  notifyWpayPaymentCompleted: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../repos/wpay-payment.repo', () => ({
  dbWpayPaymentById: jest.fn(),
  dbWpayCompleteFromCapture: jest.fn(),
}));

const payment = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: null,
  amount: 357,
  original_amount: 420,
  discount_amount: 63,
  payment_status: 'pending',
  razorpay_order_id: 'order_1',
  razorpay_payment_id: null,
  razorpay_signature: null,
  metadata: { quotedOriginalAmount: 420, quotedDiscountAmount: 63 },
  completed_at: null,
  created_at: '2026-09-05T06:23:34.000Z',
};

describe('fulfillWpayCapturedPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (notifyWpayPaymentCompleted as jest.Mock).mockResolvedValue(undefined);
  });

  it('reads quote amounts from the stored payment snapshot', () => {
    expect(quoteAmountsFromWpayPayment(payment)).toEqual({
      originalAmount: 420,
      discountAmount: 63,
    });
  });

  it('completes, accrues settlement, and notifies the vendor', async () => {
    (dbWpayPaymentById as jest.Mock).mockResolvedValue(payment);
    (dbWpayCompleteFromCapture as jest.Mock).mockResolvedValue({
      ...payment,
      payment_status: 'completed',
      razorpay_payment_id: 'pay_rzp_1',
    });
    (accrueWpaySettlement as jest.Mock).mockResolvedValue({ inserted: true, settlementId: 's1' });

    const result = await fulfillWpayCapturedPayment({
      paymentId: 'pay-1',
      razorpayPaymentId: 'pay_rzp_1',
      customerId: 'cust-1',
    });

    expect(result?.payment_status).toBe('completed');
    expect(dbWpayCompleteFromCapture).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      razorpayPaymentId: 'pay_rzp_1',
      originalAmount: 420,
      discountAmount: 63,
      customerId: 'cust-1',
    });
    expect(accrueWpaySettlement).toHaveBeenCalled();
    expect(notifyWpayPaymentCompleted).toHaveBeenCalledWith('pay-1');
  });

  it('accrues settlement idempotently when the payment is already completed', async () => {
    const completed = {
      ...payment,
      payment_status: 'completed',
      razorpay_payment_id: 'pay_rzp_1',
    };
    (dbWpayPaymentById as jest.Mock).mockResolvedValue(completed);
    (dbWpayCompleteFromCapture as jest.Mock).mockResolvedValue(completed);
    (accrueWpaySettlement as jest.Mock).mockResolvedValue({ inserted: false, settlementId: 's1' });

    const result = await fulfillWpayCapturedPayment({
      paymentId: 'pay-1',
      razorpayPaymentId: 'pay_rzp_1',
      customerId: 'cust-1',
    });

    expect(result?.payment_status).toBe('completed');
    expect(accrueWpaySettlement).toHaveBeenCalledTimes(1);
    expect(dbWpayCompleteFromCapture).toHaveBeenCalled();
  });

  it('rejects a customer mismatch', async () => {
    (dbWpayPaymentById as jest.Mock).mockResolvedValue(payment);
    await expect(
      fulfillWpayCapturedPayment({
        paymentId: 'pay-1',
        razorpayPaymentId: 'pay_rzp_1',
        customerId: 'other',
      }),
    ).resolves.toBeNull();
    expect(dbWpayCompleteFromCapture).not.toHaveBeenCalled();
  });
});

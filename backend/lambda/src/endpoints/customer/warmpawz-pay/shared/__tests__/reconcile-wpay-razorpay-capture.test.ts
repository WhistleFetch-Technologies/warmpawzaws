import { reconcileWpayRazorpayCapture } from '../reconcile-wpay-razorpay-capture';
import { fulfillWpayCapturedPayment } from '../fulfill-wpay-captured-payment';
import { razorpayRequest } from '../../../../../utils/payments/razorpay-client';

jest.mock('../fulfill-wpay-captured-payment', () => ({
  fulfillWpayCapturedPayment: jest.fn(),
}));
jest.mock('../../../../../utils/payments/razorpay-client', () => ({
  razorpayRequest: jest.fn(),
}));

const pending = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: null,
  amount: 136,
  original_amount: 160,
  discount_amount: 24,
  payment_status: 'pending',
  razorpay_order_id: 'order_TYIXDtFOt0pIAp',
  razorpay_payment_id: null,
  razorpay_signature: null,
  metadata: {},
  completed_at: null,
  created_at: '2026-09-05T08:59:09.000Z',
};

describe('reconcileWpayRazorpayCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fulfills when Razorpay order is paid and captured', async () => {
    (razorpayRequest as jest.Mock)
      .mockResolvedValueOnce({ status: 'paid', amount: 13600, amount_paid: 13600 })
      .mockResolvedValueOnce({ items: [{ id: 'pay_TYIXYhhxKaLfXb', status: 'captured' }] });
    (fulfillWpayCapturedPayment as jest.Mock).mockResolvedValue({
      ...pending,
      payment_status: 'completed',
      razorpay_payment_id: 'pay_TYIXYhhxKaLfXb',
    });

    const result = await reconcileWpayRazorpayCapture(pending, 'cust-1');
    expect(result?.razorpay_payment_id).toBe('pay_TYIXYhhxKaLfXb');
    expect(fulfillWpayCapturedPayment).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      razorpayPaymentId: 'pay_TYIXYhhxKaLfXb',
      customerId: 'cust-1',
    });
  });

  it('reuses fulfill for an already-completed payment without another Razorpay lookup', async () => {
    const completed = {
      ...pending,
      payment_status: 'completed',
      razorpay_payment_id: 'pay_already',
    };
    (fulfillWpayCapturedPayment as jest.Mock).mockResolvedValue(completed);

    const result = await reconcileWpayRazorpayCapture(completed, 'cust-1');
    expect(result?.payment_status).toBe('completed');
    expect(razorpayRequest).not.toHaveBeenCalled();
    expect(fulfillWpayCapturedPayment).toHaveBeenCalledTimes(1);
    expect(fulfillWpayCapturedPayment).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      razorpayPaymentId: 'pay_already',
      customerId: 'cust-1',
    });
  });

  it('returns null when Razorpay order was never paid', async () => {
    (razorpayRequest as jest.Mock).mockResolvedValueOnce({
      status: 'created',
      amount: 17000,
      amount_paid: 0,
    });
    await expect(reconcileWpayRazorpayCapture(pending)).resolves.toBeNull();
    expect(fulfillWpayCapturedPayment).not.toHaveBeenCalled();
  });
});

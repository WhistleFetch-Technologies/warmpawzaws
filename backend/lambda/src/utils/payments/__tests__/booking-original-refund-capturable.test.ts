import { resolvePaymentCapturableGross } from '../../../lib/services/refundable-base';

describe('booking original refund capturable gross', () => {
  it('allows GST remainder after tax-exclusive first refund', () => {
    const capturable = resolvePaymentCapturableGross({
      amount: 1699,
      total_amount: 2004.82,
      gst_amount: 305.82,
    });
    const alreadyRefunded = 1699;
    const available = Math.round((capturable - alreadyRefunded) * 100) / 100;
    expect(available).toBe(305.82);
  });

  it('marks full refund when cumulative reaches capturable total', () => {
    const capturable = resolvePaymentCapturableGross({
      amount: 1699,
      total_amount: 2004.82,
      gst_amount: 305.82,
    });
    expect(1699 + 305.82 >= capturable - 0.01).toBe(true);
  });
});

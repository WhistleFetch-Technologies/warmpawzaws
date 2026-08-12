import {
  buildRefundStripCopy,
  cancelledByLabel,
  hasChargedOrRefundedPayment,
  humanizeCancellationReason,
} from '../booking-cancel-display';

describe('booking-cancel-display', () => {
  it('labels provider cancel', () => {
    expect(cancelledByLabel('provider')).toBe('Cancelled by vendor');
  });

  it('humanizes provider decline reason', () => {
    expect(
      humanizeCancellationReason(
        "Provider declined: Operational issue. Suggested alternative: I'm not in bangalore right now"
      )
    ).toContain('Operational issue');
  });

  it('builds refund processing copy', () => {
    const copy = buildRefundStripCopy({
      amount: 2004.82,
      status: 'processing',
      method: 'original',
    });
    expect(copy?.title).toMatch(/2,?004\.82/);
    expect(copy?.subtitle).toMatch(/original payment/i);
  });

  it('detects charged/refunded payment', () => {
    expect(
      hasChargedOrRefundedPayment({
        paymentStatus: 'refunded',
        refundSummary: null,
      })
    ).toBe(true);
    expect(
      hasChargedOrRefundedPayment({
        paymentStatus: 'pending',
        refundSummary: { amount: 100, status: 'completed' },
      })
    ).toBe(true);
  });
});

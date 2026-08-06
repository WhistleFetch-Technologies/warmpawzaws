import {
  assertWapptSettlementEligible,
  isWapptAppointmentLinkedPayBill,
  resolveWapptSettlementBookingId,
} from '../wpay-settlement-policy';
import type { WpayPaymentRow } from '../../repos/wpay-payment.repo';

const basePayment: WpayPaymentRow = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: 'booking-1',
  amount: 900,
  original_amount: 1000,
  discount_amount: 100,
  payment_status: 'completed',
  razorpay_order_id: 'order-1',
  razorpay_payment_id: 'rzp-1',
  razorpay_signature: 'sig',
  metadata: {
    appointmentFeeBookingId: 'booking-1',
    appointmentFeeCredit: 200,
  },
  completed_at: '2026-08-04T10:00:00.000Z',
  created_at: '2026-08-04T09:00:00.000Z',
};

describe('wpay-settlement-policy', () => {
  it('resolves booking id from metadata first', () => {
    expect(resolveWapptSettlementBookingId(basePayment)).toBe('booking-1');
    expect(
      resolveWapptSettlementBookingId({
        ...basePayment,
        booking_id: null,
        metadata: { appointmentFeeBookingId: 'meta-booking' },
      }),
    ).toBe('meta-booking');
  });

  it('detects appointment-linked Pay Bill', () => {
    expect(isWapptAppointmentLinkedPayBill(basePayment)).toBe(true);
    expect(
      isWapptAppointmentLinkedPayBill({
        ...basePayment,
        booking_id: null,
        metadata: {},
      }),
    ).toBe(false);
  });

  it('blocks settlement when service not attested', () => {
    const result = assertWapptSettlementEligible(basePayment, {
      id: 'booking-1',
      otp_verified: false,
      commerce_mode: 'warmpawz_appointments',
    });
    expect(result).toEqual({ ok: false, skippedReason: 'service_not_attested' });
  });

  it('allows settlement when OTP verified for appointment-linked payment', () => {
    const result = assertWapptSettlementEligible(basePayment, {
      id: 'booking-1',
      otp_verified: true,
      commerce_mode: 'warmpawz_appointments',
    });
    expect(result).toEqual({ ok: true });
  });

  it('allows walk-in settlement without OTP check', () => {
    const walkIn = {
      ...basePayment,
      booking_id: null,
      metadata: { appointmentFeeCredit: 0 },
    };
    const result = assertWapptSettlementEligible(walkIn, null);
    expect(result).toEqual({ ok: true });
  });
});

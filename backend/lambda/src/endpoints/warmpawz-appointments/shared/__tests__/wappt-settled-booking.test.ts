import {
  WAPPT_SETTLED_PAYMENT_SQL,
  isWapptAdminBookingSettled,
} from '../wappt-settled-booking';

describe('isWapptAdminBookingSettled', () => {
  it('hides a checkout that only opened Razorpay', () => {
    expect(isWapptAdminBookingSettled('pending_payment', 'pending')).toBe(false);
    expect(isWapptAdminBookingSettled('confirmed', 'pending')).toBe(false);
    expect(isWapptAdminBookingSettled('pending_payment', 'paid')).toBe(false);
  });

  it('lists a booking only after the appointment fee is settled', () => {
    expect(isWapptAdminBookingSettled('confirmed', 'paid')).toBe(true);
    expect(isWapptAdminBookingSettled('completed', 'completed')).toBe(true);
    expect(isWapptAdminBookingSettled('confirmed', 'captured')).toBe(true);
  });

  it('uses the same settled rule in the admin SQL', () => {
    expect(WAPPT_SETTLED_PAYMENT_SQL).toContain("<> 'pending_payment'");
    expect(WAPPT_SETTLED_PAYMENT_SQL).toContain("'paid', 'completed', 'captured'");
  });
});

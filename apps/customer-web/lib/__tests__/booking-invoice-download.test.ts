import { isBookingPaidForInvoice } from '../booking-invoice-download';

describe('isBookingPaidForInvoice', () => {
  it('is true once payment_status is paid, even if the visit is not completed', () => {
    expect(
      isBookingPaidForInvoice({ paymentStatus: 'paid' })
    ).toBe(true);
    expect(
      isBookingPaidForInvoice({ payment_status: 'completed' })
    ).toBe(true);
  });

  it('is false for unpaid pending bookings', () => {
    expect(isBookingPaidForInvoice({ paymentStatus: 'pending' })).toBe(false);
    expect(isBookingPaidForInvoice({})).toBe(false);
  });

  it('stays true after refund so the original tax invoice remains downloadable', () => {
    expect(isBookingPaidForInvoice({ paymentStatus: 'refunded' })).toBe(true);
  });

  it('honors isPaid from the financial snapshot', () => {
    expect(isBookingPaidForInvoice({ isPaid: true, paymentStatus: 'pending' })).toBe(true);
  });
});

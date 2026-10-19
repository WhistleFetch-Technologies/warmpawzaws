/** Admin Warmpawz Appointments list: Razorpay-open holds are not orders. */
export function isWapptAdminBookingSettled(status: unknown, paymentStatus: unknown): boolean {
  const bookingStatus = String(status ?? '').trim().toLowerCase();
  const payment = String(paymentStatus ?? '').trim().toLowerCase();
  if (bookingStatus === 'pending_payment') return false;
  return payment === 'paid' || payment === 'completed' || payment === 'captured';
}

export const WAPPT_SETTLED_PAYMENT_SQL = `
  AND LOWER(COALESCE(b.status, '')) <> 'pending_payment'
  AND LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'captured')`;

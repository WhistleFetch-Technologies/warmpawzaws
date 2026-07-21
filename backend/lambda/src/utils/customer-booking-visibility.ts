/** Bookings tagged in notes with this marker are omitted from customer My Bookings lists. */
export const CUSTOMER_HIDDEN_BOOKING_MARKER = 'wp_customer_hidden';

export const SQL_CUSTOMER_BOOKING_LIST_VISIBLE = `COALESCE(b.notes, '') NOT LIKE '%${CUSTOMER_HIDDEN_BOOKING_MARKER}%'`;

export function markBookingNotesCustomerHidden(notes: string | null | undefined): string {
  const base = String(notes ?? '').trim();
  if (base.includes(CUSTOMER_HIDDEN_BOOKING_MARKER)) return base;
  return base ? `${base} | ${CUSTOMER_HIDDEN_BOOKING_MARKER}:true` : `${CUSTOMER_HIDDEN_BOOKING_MARKER}:true`;
}

/** SQL CASE expression: re-confirm bookings paid on Razorpay but auto-cancelled by hold expiry. */
export const SQL_RECONFIRM_PAID_AFTER_HOLD_CANCEL = `
  CASE
    WHEN status = 'cancelled'
      AND COALESCE(cancellation_reason, '') = 'payment_window_expired'
      AND COALESCE(payment_status, '') IN ('paid', 'completed')
    THEN 'confirmed'
    WHEN status IN ('pending', 'pending_payment') THEN 'confirmed'
    ELSE status
  END
`;

/**
 * 5-minute payment hold for pre-Razorpay bookings (pending_payment).
 * Slots are soft-reserved until hold expires; vendors are not notified until paid.
 */

import { query, withTransaction } from '../database/rds-connection';
import { logAuditEntry, logBookingStatusChange } from './audit-log';

export const PAYMENT_HOLD_TTL_SECONDS = 300;

/** Bookings in these states block slot overlap checks (excluding expired pending_payment). */
export const SQL_BOOKING_BLOCKS_SLOT = `
  status NOT IN ('cancelled', 'no_show', 'rescheduled')
  AND NOT (
    status = 'pending_payment'
    AND payment_hold_expires_at IS NOT NULL
    AND payment_hold_expires_at <= NOW()
  )
`;

export function paymentHoldExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_HOLD_TTL_SECONDS * 1000);
}

export function secondsRemainingUntilHoldExpiry(expiresAt: Date | string | null | undefined): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

export function isPaymentHoldActive(row: {
  status?: string | null;
  payment_hold_expires_at?: Date | string | null;
}): boolean {
  if (String(row.status || '') !== 'pending_payment') return false;
  const exp = row.payment_hold_expires_at;
  if (!exp) return true;
  return new Date(exp).getTime() > Date.now();
}

export interface ExpirePaymentHoldsResult {
  expiredCount: number;
  bookingIds: string[];
  timestamp: string;
}

/**
 * Cancel unpaid pending_payment bookings whose hold window has elapsed.
 * Does not notify vendors (payment_window_expired).
 */
export async function expirePaymentHolds(options?: {
  limit?: number;
  requestId?: string;
}): Promise<ExpirePaymentHoldsResult> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const requestId = options?.requestId;

  const { rows } = await query(
    `SELECT b.id, b.status, b.vendor_id, b.customer_id
     FROM bookings b
     WHERE b.status = 'pending_payment'
       AND (
         (b.payment_hold_expires_at IS NOT NULL AND b.payment_hold_expires_at <= NOW())
         OR (
           b.payment_hold_expires_at IS NULL
           AND b.created_at IS NOT NULL
           AND b.created_at + INTERVAL '5 minutes' <= NOW()
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.booking_id = b.id
           AND LOWER(COALESCE(p.payment_status, '')) IN ('paid', 'completed')
       )
     ORDER BY COALESCE(b.payment_hold_expires_at, b.created_at) ASC
     LIMIT $1`,
    [limit]
  );

  const bookingIds: string[] = [];
  const reason = 'payment_window_expired';

  for (const row of rows) {
    const bookingId = String(row.id);
    const oldStatus = String(row.status || 'pending_payment');
    try {
      await withTransaction(async (client) => {
        const locked = await client.query(
          `SELECT id, status FROM bookings WHERE id = $1::uuid FOR UPDATE`,
          [bookingId]
        );
        if (locked.rows.length === 0) return;
        if (String(locked.rows[0].status) !== 'pending_payment') return;

        await client.query(
          `UPDATE payments
           SET payment_status = CASE
             WHEN LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed') THEN payment_status
             ELSE 'expired'
           END,
           updated_at = NOW()
           WHERE booking_id = $1::uuid`,
          [bookingId]
        );

        await client.query(
          `UPDATE bookings
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancellation_reason = $2,
               updated_at = NOW()
           WHERE id = $1::uuid`,
          [bookingId, reason]
        );
      });

      await logBookingStatusChange(bookingId, oldStatus, 'cancelled', 'system', 'system', reason);
      await logAuditEntry({
        entityType: 'booking',
        entityId: bookingId,
        action: 'update',
        oldValues: { status: oldStatus },
        newValues: { status: 'cancelled', cancellation_reason: reason, paymentHoldExpired: true },
        changedFields: ['status', 'cancellation_reason'],
        actorId: 'system',
        actorType: 'system',
        requestId,
      });

      bookingIds.push(bookingId);
    } catch (err) {
      console.warn('[payment-hold] Failed to expire booking', bookingId, err);
    }
  }

  return {
    expiredCount: bookingIds.length,
    bookingIds,
    timestamp: new Date().toISOString(),
  };
}

export interface PaymentResumeContext {
  entityType: 'booking';
  entityId: string;
  bookingId: string;
  vendorId: string;
  vendorName?: string | null;
  serviceId: string;
  serviceName?: string | null;
  serviceStyle: string;
  serviceType: string;
  bookingDate: string;
  bookingTime: string;
  petId?: string | null;
  customerId: string;
  amount: number;
  currency: string;
  paymentHoldExpiresAt: string | null;
  secondsRemaining: number;
  canResume: boolean;
  razorpayOrderId: string | null;
  paymentId: string | null;
}

export async function buildBookingPaymentResumeContext(
  bookingId: string
): Promise<PaymentResumeContext | null> {
  const { rows } = await query(
    `SELECT b.*,
            v.business_name AS vendor_name,
            COALESCE(s.name, sc.service_name, vs_row.vs_service_name) AS resolved_service_name
     FROM bookings b
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN service_catalog sc ON b.service_id = sc.id
     LEFT JOIN LATERAL (
       SELECT vs.service_name AS vs_service_name
       FROM vendor_services vs
       WHERE vs.vendor_id = b.vendor_id
         AND (vs.service_id = b.service_id OR vs.id = b.service_id)
       ORDER BY
         CASE WHEN vs.service_id = b.service_id THEN 0 WHEN vs.id = b.service_id THEN 1 ELSE 2 END,
         vs.updated_at DESC NULLS LAST
       LIMIT 1
     ) vs_row ON true
     WHERE b.id = $1::uuid
     LIMIT 1`,
    [bookingId]
  );
  if (rows.length === 0) return null;

  const b = rows[0] as Record<string, unknown>;
  const status = String(b.status || '');
  const paymentStatus = String(b.payment_status || '').toLowerCase();
  const paidLike = paymentStatus === 'paid' || paymentStatus === 'completed';
  const unpaidPending =
    status === 'pending_payment' || (status === 'confirmed' && !paidLike && paymentStatus === 'pending');

  if (!unpaidPending) return null;

  const expiresAt = b.payment_hold_expires_at
    ? new Date(String(b.payment_hold_expires_at)).toISOString()
    : null;
  const secondsRemaining = secondsRemainingUntilHoldExpiry(expiresAt);
  const canResume = isPaymentHoldActive({ status, payment_hold_expires_at: expiresAt });

  const payRes = await query(
    `SELECT id, razorpay_order_id, amount, currency, payment_status
     FROM payments
     WHERE booking_id = $1::uuid
       AND LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [bookingId]
  );
  const pay = payRes.rows[0] as Record<string, unknown> | undefined;

  const serviceType = String(b.service_type || b.service_style || 'at_center');
  const serviceStyle =
    serviceType === 'at_vendor' ? 'at_center' : serviceType === 'at_home' ? 'at_home' : serviceType;

  return {
    entityType: 'booking',
    entityId: bookingId,
    bookingId,
    vendorId: String(b.vendor_id || ''),
    vendorName: (b.vendor_name as string) || null,
    serviceId: String(b.service_id || ''),
    serviceName: (b.resolved_service_name as string) || null,
    serviceStyle,
    serviceType,
    bookingDate: String(b.booking_date || ''),
    bookingTime: String(b.booking_time || ''),
    petId: b.pet_id ? String(b.pet_id) : null,
    customerId: String(b.customer_id || ''),
    amount: Number(b.total_amount || pay?.amount || 0),
    currency: String(pay?.currency || 'INR'),
    paymentHoldExpiresAt: expiresAt,
    secondsRemaining,
    canResume,
    razorpayOrderId: pay?.razorpay_order_id ? String(pay.razorpay_order_id) : null,
    paymentId: pay?.id ? String(pay.id) : null,
  };
}

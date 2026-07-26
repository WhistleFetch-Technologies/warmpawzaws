/**
 * Ensure in-person bookings have a start/check-in OTP after payment confirmation.
 * Used by payment-verify, webhooks, and reconciliation (paths that skip the verify callback).
 */

import { query } from '../database/rds-connection';

const TELE_SERVICE_TYPES = new Set([
  'tele',
  'online',
  'video_consultation',
  'tele_consultation',
]);

const TERMINAL_BOOKING_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

export type BookingOtpQueryFn = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: Array<Record<string, unknown>> }>;

export function generateFourDigitBookingOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function isTeleBookingServiceType(serviceType: string | null | undefined): boolean {
  return TELE_SERVICE_TYPES.has(String(serviceType || '').toLowerCase());
}

export function bookingStatusEligibleForStartOtp(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return true;
  return !TERMINAL_BOOKING_STATUSES.has(s);
}

export async function ensureBookingStartOtpIfNeeded(
  bookingId: string,
  options?: {
    execQuery?: BookingOtpQueryFn;
    logPrefix?: string;
    /** When false, skip if booking is completed/cancelled/no_show. Default true. */
    requireActiveStatus?: boolean;
  }
): Promise<{ generated: boolean; otpCode?: string; reason?: string }> {
  const execQuery = options?.execQuery ?? ((sql, params) => query(sql, params as never[]));
  const logPrefix = options?.logPrefix ?? '[BOOKING-OTP]';
  const requireActiveStatus = options?.requireActiveStatus !== false;

  try {
    const { rows } = await execQuery(
      `SELECT service_type, otp_code, payment_status, status
       FROM bookings
       WHERE id = $1`,
      [bookingId]
    );
    const row = rows[0];
    if (!row) {
      return { generated: false, reason: 'not_found' };
    }

    const existingOtp = row.otp_code != null ? String(row.otp_code).trim() : '';
    if (existingOtp) {
      return { generated: false, otpCode: existingOtp, reason: 'already_set' };
    }

    const serviceType = String(row.service_type || '');
    if (isTeleBookingServiceType(serviceType)) {
      return { generated: false, reason: 'tele_service' };
    }

    const paymentStatus = String(row.payment_status || '').toLowerCase();
    if (paymentStatus !== 'paid' && paymentStatus !== 'completed') {
      return { generated: false, reason: 'not_paid' };
    }

    if (requireActiveStatus && !bookingStatusEligibleForStartOtp(String(row.status || ''))) {
      return { generated: false, reason: 'terminal_status' };
    }

    const otpCode = generateFourDigitBookingOtp();
    const otpExpiry = new Date();
    otpExpiry.setHours(otpExpiry.getHours() + 24);

    const updated = await execQuery(
      `UPDATE bookings
       SET otp_code = $1,
           otp_expires_at = $2,
           updated_at = NOW()
       WHERE id = $3
         AND otp_code IS NULL
       RETURNING otp_code`,
      [otpCode, otpExpiry.toISOString(), bookingId]
    );

    if (updated.rows.length > 0) {
      console.log(
        `${logPrefix} OTP ${otpCode} generated for booking ${bookingId} (service_type: ${serviceType})`
      );
      return { generated: true, otpCode };
    }

    const { rows: afterRows } = await execQuery(
      `SELECT otp_code FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const afterOtp =
      afterRows[0]?.otp_code != null ? String(afterRows[0].otp_code).trim() : '';
    if (afterOtp) {
      return { generated: false, otpCode: afterOtp, reason: 'already_set' };
    }

    return { generated: false, reason: 'update_noop' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${logPrefix} Failed to generate OTP for booking ${bookingId}:`, message);
    return { generated: false, reason: 'error' };
  }
}

/** Fire-and-forget helper for reconciliation / post-commit webhook hooks. */
export function scheduleBookingStartOtpIfNeeded(
  bookingId: string | null | undefined,
  logPrefix: string
): void {
  if (!bookingId) return;
  void ensureBookingStartOtpIfNeeded(String(bookingId), { logPrefix }).catch((err) => {
    console.warn(`${logPrefix} OTP schedule failed for ${bookingId}:`, err);
  });
}

/** Backfill OTP on list loads for paid in-person bookings that missed verify/webhook OTP. */
export async function backfillMissingBookingStartOtps(bookingRows: Array<Record<string, unknown>>): Promise<void> {
  const candidates = bookingRows.filter((row) => {
    const paymentStatus = String(row.payment_status || '').toLowerCase();
    if (paymentStatus !== 'paid' && paymentStatus !== 'completed') return false;
    const otp = row.otp_code != null ? String(row.otp_code).trim() : '';
    if (otp) return false;
    if (isTeleBookingServiceType(String(row.service_type || row.serviceType || ''))) return false;
    return bookingStatusEligibleForStartOtp(String(row.status || ''));
  });

  if (candidates.length === 0) return;

  await Promise.all(
    candidates.map(async (row) => {
      const bookingId = String(row.id);
      const result = await ensureBookingStartOtpIfNeeded(bookingId, {
        logPrefix: '[RECONCILE-T3]',
      });
      if (result.otpCode) {
        row.otp_code = result.otpCode;
      }
    })
  );
}

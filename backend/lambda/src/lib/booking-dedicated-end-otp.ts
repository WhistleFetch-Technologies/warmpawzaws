import { query, insert } from '../database/rds-connection';

/**
 * After start OTP is verified, create a dedicated end-session OTP (otp_tokens + bookings.completion_otp)
 * for roles that complete with a different code than bookings.otp_code.
 */
export async function ensureDedicatedEndSessionOtp(bookingId: string): Promise<void> {
  const existing = await query(
    `SELECT id FROM otp_tokens
     WHERE metadata->>'bookingId' = $1
       AND metadata->>'action' = 'end'
       AND is_used = false
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] }));
  if ((existing as any).rows?.length) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await insert('otp_tokens', {
    phone: null,
    otp_code: otp,
    otp_type: 'booking_end',
    expires_in_minutes: 1440,
    max_attempts: 5,
    metadata: { bookingId, action: 'end' },
  });
  await query(`UPDATE bookings SET completion_otp = $1, updated_at = NOW() WHERE id = $2`, [otp, bookingId]).catch((e: any) =>
    console.warn('[END-SESSION-OTP] completion_otp update skipped:', e?.message)
  );
}

import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerBookingsGet0(bookingQuery, params) {
  return await query(bookingQuery, params);
}

export async function dbCustomerBookingsGet1(b) {
  return await query(
                `SELECT otp_code FROM otp_tokens
                 WHERE metadata->>'bookingId' = $1
                   AND metadata->>'action' = 'end'
                   AND is_used = false
                   AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [b.id]
              )
}


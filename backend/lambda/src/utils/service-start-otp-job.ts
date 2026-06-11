/**
 * Cron job: notify customer with start OTP when scheduled service time arrives.
 * Uses unified dispatcher via notifyBookingStartOtp.
 */

import { query, update } from '../database/rds-connection';
import { notifyBookingStartOtp } from './booking-notifications';

function generateFourDigitOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function processServiceStartOtpNotifications(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
}> {
  const { rows } = await query(
    `SELECT
       b.id,
       b.customer_id,
       b.otp_code,
       b.service_type,
       v.business_name AS vendor_name,
       COALESCE(vs.service_name, 'Service') AS service_name
     FROM bookings b
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN vendor_services vs ON vs.id = b.service_id
     WHERE b.status IN ('confirmed', 'paid', 'scheduled')
       AND COALESCE(b.start_otp_notification_sent, false) = false
       AND b.customer_id IS NOT NULL
       AND LOWER(COALESCE(b.service_type, '')) NOT IN ('tele', 'online', 'video_consultation')
       AND (b.booking_date + b.booking_time::time) <= NOW()
       AND (b.booking_date + b.booking_time::time) > NOW() - INTERVAL '3 minutes'`,
  );

  let sent = 0;
  let skipped = 0;

  for (const row of rows as Array<Record<string, unknown>>) {
    const bookingId = String(row.id);
    let otp = row.otp_code != null ? String(row.otp_code).trim() : '';
    if (!otp) {
      otp = generateFourDigitOtp();
      await update('bookings', { id: bookingId }, { otp_code: otp }).catch((err) => {
        console.warn('[start-otp-job] otp_code update failed:', (err as Error).message);
      });
    }

    const result = await notifyBookingStartOtp({
      bookingId,
      customerId: String(row.customer_id),
      vendorName: String(row.vendor_name || 'Provider'),
      serviceName: String(row.service_name || 'Service'),
      otp,
    });

    if (result.sent) {
      sent++;
      await update(
        'bookings',
        { id: bookingId },
        {
          start_otp_notification_sent: true,
          start_otp_notification_sent_at: new Date().toISOString(),
        },
      ).catch((err) => {
        console.warn('[start-otp-job] flag update failed:', (err as Error).message);
      });
    } else {
      skipped++;
    }
  }

  return { processed: rows.length, sent, skipped };
}

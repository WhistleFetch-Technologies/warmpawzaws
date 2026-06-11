-- ============================================================================
-- MIGRATION 1032: Service start OTP push at scheduled appointment time
-- ============================================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS start_otp_notification_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS start_otp_notification_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.start_otp_notification_sent IS
    'True after customer received booking_start_otp at scheduled service start time';

CREATE INDEX IF NOT EXISTS idx_bookings_start_otp_pending
    ON bookings (booking_date, booking_time)
    WHERE start_otp_notification_sent = false
      AND status IN ('confirmed', 'paid', 'scheduled');

-- ============================================================================
-- MIGRATION 753: Tele consultation attendance & qualified completion tracking
-- ============================================================================
-- Adds real participant join/leave timestamps, overlap duration, and
-- tele_completion_status on bookings for refund-safe states (no refunds yet).
-- ============================================================================

-- video_call_sessions: attendance & qualification columns
ALTER TABLE video_call_sessions
  ADD COLUMN IF NOT EXISTS customer_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overlap_duration_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completion_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consultation_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN video_call_sessions.customer_joined_at IS 'First time customer entered the Chime call (API join, not token creation)';
COMMENT ON COLUMN video_call_sessions.vendor_joined_at IS 'First time vendor entered the Chime call';
COMMENT ON COLUMN video_call_sessions.overlap_duration_seconds IS 'Seconds both customer and vendor were present simultaneously';
COMMENT ON COLUMN video_call_sessions.completion_qualified IS 'True when overlap meets minimum consultation threshold';

-- bookings: tele-specific completion outcome (separate from status)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tele_completion_status VARCHAR(50);

COMMENT ON COLUMN bookings.tele_completion_status IS
  'Tele outcome: waiting_for_vendor, vendor_no_show, customer_no_show, incomplete_call, qualified, disputed';

CREATE INDEX IF NOT EXISTS idx_video_call_sessions_booking_attendance
  ON video_call_sessions (booking_id)
  WHERE customer_joined_at IS NOT NULL OR vendor_joined_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_tele_completion_status
  ON bookings (tele_completion_status)
  WHERE tele_completion_status IS NOT NULL;

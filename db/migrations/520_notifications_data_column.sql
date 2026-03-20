-- Add data column to notifications for tele_call_incoming and other payloads
-- Fixes 500 on POST /video-call/notify-ready when inserting notification with booking_id/meeting_id
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;

COMMENT ON COLUMN notifications.data IS 'Optional JSON payload (e.g. booking_id, meeting_id, call_type for tele_call_incoming)';

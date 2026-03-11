-- Add rescheduled_at column to track when booking was rescheduled
-- This allows vendors to identify rescheduled bookings in their dashboard
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.rescheduled_at IS 'Timestamp when booking was rescheduled to a new date/time. NULL if booking was never rescheduled.';

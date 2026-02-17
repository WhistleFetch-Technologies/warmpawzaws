-- Add end_date column to events table (admin event management uses it)
-- Backend events.ts expects end_date for multi-day events
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
COMMENT ON COLUMN events.end_date IS 'End date for multi-day events; defaults to event_date if not set';

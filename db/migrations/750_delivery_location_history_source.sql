-- Append-only GPS history: optional source tag (e.g. pidge webhook vs internal fleet API).
ALTER TABLE delivery_location_history
  ADD COLUMN IF NOT EXISTS source VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_location_history_tracking_source
  ON delivery_location_history (tracking_id, recorded_at DESC)
  WHERE source IS NOT NULL;

COMMENT ON COLUMN delivery_location_history.source IS 'Origin of GPS point: pidge, partner_app, etc.';

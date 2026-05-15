CREATE INDEX IF NOT EXISTS idx_location_history_tracking ON delivery_location_history(tracking_id, recorded_at DESC);

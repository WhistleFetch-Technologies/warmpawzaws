CREATE INDEX IF NOT EXISTS idx_analytics_events_error_occurred
  ON analytics_events (error_code, occurred_at DESC)
  WHERE error_code IS NOT NULL;

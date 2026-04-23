CREATE INDEX IF NOT EXISTS idx_analytics_events_type_occurred
  ON analytics_events (event_type, occurred_at DESC);

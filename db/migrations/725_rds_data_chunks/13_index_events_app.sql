CREATE INDEX IF NOT EXISTS idx_analytics_events_app_occurred
  ON analytics_events (app, occurred_at DESC);

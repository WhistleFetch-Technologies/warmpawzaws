CREATE INDEX IF NOT EXISTS idx_analytics_events_screen_occurred
  ON analytics_events (screen_name, occurred_at DESC)
  WHERE screen_name IS NOT NULL;

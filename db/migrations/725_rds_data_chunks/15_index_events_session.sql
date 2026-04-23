CREATE INDEX IF NOT EXISTS idx_analytics_events_session_occurred
  ON analytics_events (session_id, occurred_at);

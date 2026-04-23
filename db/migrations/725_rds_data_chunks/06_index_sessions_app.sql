CREATE INDEX IF NOT EXISTS idx_analytics_sessions_app_started
  ON analytics_sessions (app, started_at DESC);

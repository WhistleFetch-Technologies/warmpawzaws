CREATE INDEX IF NOT EXISTS idx_analytics_events_user_occurred
  ON analytics_events (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

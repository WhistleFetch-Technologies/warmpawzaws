CREATE INDEX IF NOT EXISTS idx_analytics_sessions_actor_last_seen
  ON analytics_sessions (actor_id, last_seen_at DESC)
  WHERE actor_id IS NOT NULL;

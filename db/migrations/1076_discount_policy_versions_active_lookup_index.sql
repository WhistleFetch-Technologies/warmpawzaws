-- The runtime policy loader runs this on every cold cache refresh (30s TTL):
--   SELECT ... FROM discount_policy_versions
--   WHERE status = 'active' ORDER BY published_at DESC LIMIT 1
-- On Jul 14 2026 this lookup timed out repeatedly during a prod DB slowness event
-- (some executions took 10+ minutes) and the engine fell back to default policy.
-- A partial index on the active rows makes the lookup an index-only walk.
CREATE INDEX IF NOT EXISTS idx_discount_policy_versions_active_published_at
  ON discount_policy_versions (published_at DESC)
  WHERE status = 'active';

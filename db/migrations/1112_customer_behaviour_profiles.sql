-- ============================================================================
-- 1112_customer_behaviour_profiles.sql
-- Behaviour profile store (HLD §29–30 / master plan §4.2)
-- Evaluate reads this snapshot — do not live-scan all bookings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_behaviour_profiles (
  user_id TEXT PRIMARY KEY,
  overall JSONB NOT NULL DEFAULT '{}'::jsonb,
  services JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_behaviour_profiles_updated
  ON customer_behaviour_profiles (updated_at DESC);

COMMENT ON TABLE customer_behaviour_profiles IS
  'Per-customer behaviour snapshot: overall + services.{grooming|vet|training|boarding|walking|ecommerce}';
COMMENT ON COLUMN customer_behaviour_profiles.overall IS
  'completed_orders, total_spend, aov, last_completed_at, …';
COMMENT ON COLUMN customer_behaviour_profiles.services IS
  'Per-axis { completed_count, last_completed_at, total_spend }';

CREATE TABLE IF NOT EXISTS customer_behaviour_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  service_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_behaviour_events_user
  ON customer_behaviour_events (user_id, created_at DESC);

COMMENT ON TABLE customer_behaviour_events IS
  'Optional append-only replay/debug cursor for behaviour upserts (Abhi Phase 2)';

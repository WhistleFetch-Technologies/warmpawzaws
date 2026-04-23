-- ============================================================================
-- Allyticas: Product analytics on RDS Postgres (single source of truth)
-- Partition-ready by occurred_at (monthly RANGE); partitions NOT created in MVP.
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE analytics_app_enum AS ENUM ('customer_web', 'vendor_web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE analytics_actor_type_enum AS ENUM ('customer', 'vendor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE analytics_environment_enum AS ENUM ('dev', 'staging', 'prod');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE analytics_event_type_enum AS ENUM (
    'screen_view',
    'screen_end',
    'tap',
    'scroll',
    'filter',
    'tab_change',
    'search',
    'error',
    'api_timing',
    'notification_open',
    'notification_dismiss',
    'drop_off',
    'rage_click',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sessions
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL,
  actor_type analytics_actor_type_enum NULL,
  actor_id UUID NULL,
  app analytics_app_enum NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT analytics_sessions_session_key_unique UNIQUE (session_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_app_started
  ON analytics_sessions (app, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_actor_last_seen
  ON analytics_sessions (actor_id, last_seen_at DESC)
  WHERE actor_id IS NOT NULL;

COMMENT ON TABLE analytics_sessions IS 'Product analytics sessions; partition parent N/A.';
COMMENT ON COLUMN analytics_sessions.actor_type IS 'NULL before login';

-- Events (append-only). Future: PARTITION BY RANGE (occurred_at) monthly — recreate indexes per child.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
  actor_type analytics_actor_type_enum NULL,
  actor_id UUID NULL,
  app analytics_app_enum NOT NULL,
  event_type analytics_event_type_enum NOT NULL,
  event_name TEXT NOT NULL,
  screen_name TEXT NULL,
  duration_ms INTEGER NULL,
  api_name TEXT NULL,
  error_code TEXT NULL,
  environment analytics_environment_enum NOT NULL,
  version SMALLINT NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_ts TIMESTAMPTZ NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT analytics_events_properties_object CHECK (jsonb_typeof(properties) = 'object')
);

COMMENT ON TABLE analytics_events IS 'Append-only events. For monthly partitions: migrate table to PARTITION BY RANGE (occurred_at); recreate indexes below on each partition.';
COMMENT ON COLUMN analytics_events.occurred_at IS 'Authoritative ordering; partition key when partitioned';

CREATE INDEX IF NOT EXISTS idx_analytics_events_app_occurred
  ON analytics_events (app, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_occurred
  ON analytics_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_occurred
  ON analytics_events (session_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_occurred
  ON analytics_events (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_screen_occurred
  ON analytics_events (screen_name, occurred_at DESC)
  WHERE screen_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_error_occurred
  ON analytics_events (error_code, occurred_at DESC)
  WHERE error_code IS NOT NULL;

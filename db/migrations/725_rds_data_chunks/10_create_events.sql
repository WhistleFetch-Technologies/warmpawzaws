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

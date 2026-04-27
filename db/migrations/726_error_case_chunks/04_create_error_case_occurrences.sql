CREATE TABLE IF NOT EXISTS error_case_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES product_error_cases(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES analytics_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT error_case_occurrences_event_unique UNIQUE (event_id)
);

COMMENT ON TABLE error_case_occurrences IS 'Links analytics_events error rows to product_error_cases; CASCADE delete when event removed by retention job.';

CREATE TABLE IF NOT EXISTS product_error_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(64) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status analytics_error_case_status_enum NOT NULL DEFAULT 'open',
  priority analytics_error_case_priority_enum NOT NULL DEFAULT 'p3',
  deadline_at TIMESTAMPTZ NULL,
  assigned_admin_id UUID NULL REFERENCES admins(id) ON DELETE SET NULL,
  notes TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrence_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_error_cases_fingerprint_unique UNIQUE (fingerprint)
);

COMMENT ON TABLE product_error_cases IS 'Allyticas error triage: one row per fingerprint; occurrence_count increments on ingest (may exceed remaining rows after analytics retention deletes events).';
COMMENT ON COLUMN product_error_cases.fingerprint IS 'SHA-256 hex (64 chars) over app + error_code + normalized message/stack fingerprint';

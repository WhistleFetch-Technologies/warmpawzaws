/* Policy Center V2 — draft, published versions, history, audit */
CREATE TABLE IF NOT EXISTS discount_policy_draft (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  bundle JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS discount_policy_versions (
  publish_id TEXT PRIMARY KEY,
  bundle JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_discount_policy_versions_published_at
  ON discount_policy_versions (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_discount_policy_versions_status
  ON discount_policy_versions (status);

CREATE TABLE IF NOT EXISTS discount_policy_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  publish_id TEXT,
  actor TEXT,
  fingerprint TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_policy_audit_created_at
  ON discount_policy_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discount_policy_audit_event_type
  ON discount_policy_audit (event_type);

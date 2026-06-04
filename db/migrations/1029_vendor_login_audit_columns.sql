-- Vendor login history: harmonize audit_logs columns across migration variants (010/011/054).
-- Additive only; safe to re-run.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_vendor_login
  ON audit_logs (entity_type, entity_id, action, created_at DESC);

COMMENT ON INDEX idx_audit_logs_vendor_login IS 'Vendor login history lookups (entity_type=vendor, action=login)';

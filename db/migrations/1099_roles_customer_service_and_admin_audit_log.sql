-- ============================================================================
-- Migration 1099: roles.customer_service + admin_audit_log (prod parity)
-- ============================================================================
-- Prod never received 139 / 061. Warmpawz Pay/Appointments catalogue SQL
-- selects roles.customer_service; Platform Settings propagate inserts
-- admin_audit_log. Idempotent and additive only.
-- ============================================================================

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS customer_service TEXT;

UPDATE roles
SET customer_service = NULLIF(TRIM(config->>'customer_service'), '')
WHERE customer_service IS NULL
  AND NULLIF(TRIM(config->>'customer_service'), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roles_customer_service
  ON roles (customer_service)
  WHERE customer_service IS NOT NULL;

COMMENT ON COLUMN roles.customer_service IS
  'Maps role to customer app service (vet, grooming, etc.). Backfilled from config.customer_service when missing.';

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    performed_by TEXT,
    actor_type TEXT DEFAULT 'admin',
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON admin_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_at ON admin_audit_log (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log (performed_by) WHERE performed_by IS NOT NULL;

COMMENT ON TABLE admin_audit_log IS 'Audit log for admin governance actions';

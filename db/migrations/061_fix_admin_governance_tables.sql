-- ============================================================================
-- MIGRATION 061: FIX ADMIN GOVERNANCE TABLES
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Create admin_audit_log table for governance status endpoint
-- ============================================================================

-- Admin Audit Log Table (for governance status)
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

-- Indexes for admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_at ON admin_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(performed_by) WHERE performed_by IS NOT NULL;

-- Comments
COMMENT ON TABLE admin_audit_log IS 'Audit log for admin governance actions';
COMMENT ON COLUMN admin_audit_log.action IS 'Action performed (e.g., cache_invalidate, capability_refresh)';
COMMENT ON COLUMN admin_audit_log.performed_by IS 'Admin user who performed the action';
COMMENT ON COLUMN admin_audit_log.resource_type IS 'Type of resource affected (e.g., vendor, service, cache)';
COMMENT ON COLUMN admin_audit_log.resource_id IS 'ID of resource affected';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

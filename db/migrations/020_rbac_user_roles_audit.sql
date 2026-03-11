-- ============================================================================
-- MIGRATION 020: RBAC User Roles and Audit Logs
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create tables for user role assignments and RBAC audit logs
-- ============================================================================

-- User Role Assignments
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References users table (could be admin or vendor)
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID, -- Admin who assigned the role
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active) WHERE is_active = true;

COMMENT ON TABLE user_roles IS 'Stores user role assignments, replacing KV store usage (user:{userId}:roles keys)';

-- RBAC Audit Logs
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- 'role_assigned', 'role_removed', 'permission_granted', etc.
    user_id UUID NOT NULL, -- User who performed the action
    target_user_id UUID, -- User affected by the action
    role_id UUID REFERENCES roles(id),
    permission_name TEXT,
    details JSONB, -- Additional action details
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_user ON rbac_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON rbac_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_action ON rbac_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_logs(created_at DESC);

COMMENT ON TABLE rbac_audit_logs IS 'Stores RBAC audit logs, replacing KV store usage (rbac:audit:* keys)';

-- Permissions Catalog (static list)
CREATE TABLE IF NOT EXISTS rbac_permissions_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key TEXT NOT NULL UNIQUE,
    permission_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    resource TEXT,
    action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_permissions_category ON rbac_permissions_catalog(category);
CREATE INDEX IF NOT EXISTS idx_rbac_permissions_key ON rbac_permissions_catalog(permission_key);

COMMENT ON TABLE rbac_permissions_catalog IS 'Stores available permissions catalog, replacing KV store usage (rbac:permissions:list key)';


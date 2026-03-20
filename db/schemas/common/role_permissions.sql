-- ============================================================================
-- ROLE_PERMISSIONS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    permission_name TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT role_permissions_role_permission_resource_action_unique UNIQUE (role_id, permission_name, resource, action)
);

ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX role_permissions_pkey ON role_permissions(id);
CREATE UNIQUE INDEX role_permissions_role_permission_resource_action_unique ON role_permissions(role_id, permission_name, resource, action);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

COMMENT ON TABLE role_permissions IS 'Role permissions (RBAC)';

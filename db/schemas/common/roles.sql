-- ============================================================================
-- ROLES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);
CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);
CREATE INDEX idx_roles_is_active ON public.roles USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE roles IS 'Maps from admin:roles:list KV key';
COMMENT ON COLUMN roles.name IS 'Role name (unique)';
COMMENT ON COLUMN roles.display_name IS 'Display name for the role';
COMMENT ON COLUMN roles.description IS 'Role description';
COMMENT ON COLUMN roles.is_system_role IS 'Whether this is a system role';
COMMENT ON COLUMN roles.is_active IS 'Whether role is active';

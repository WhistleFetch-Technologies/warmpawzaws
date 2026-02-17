-- ============================================================================
-- ADMIN RBAC: role_type on roles, admin_role_id on admins, admin roles & permissions
-- ============================================================================
-- Enables permission-based admin access and admin user lifecycle (create, OTP set/reset password).
-- ============================================================================

-- 1. Add role_type to roles (admin vs vendor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'role_type'
  ) THEN
    ALTER TABLE roles ADD COLUMN role_type TEXT DEFAULT 'vendor';
    COMMENT ON COLUMN roles.role_type IS 'vendor = platform vendor role (vet_solo etc); admin = admin portal role (super_admin, admin, support_admin)';
  END IF;
END $$;

-- Allow NULL for backward compat; existing roles stay vendor
UPDATE roles SET role_type = 'vendor' WHERE role_type IS NULL;

-- 2. Add admin_role_id to admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admins' AND column_name = 'admin_role_id'
  ) THEN
    ALTER TABLE admins ADD COLUMN admin_role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_admins_admin_role_id ON admins(admin_role_id);
    COMMENT ON COLUMN admins.admin_role_id IS 'FK to roles (role_type=admin). Permissions resolved from role_permissions for this role.';
  END IF;
END $$;

-- 3. Create admin roles (idempotent)
INSERT INTO roles (name, display_name, description, is_system_role, is_active, role_type)
VALUES
  ('super_admin', 'Super Admin', 'Full access to admin portal', true, true, 'admin'),
  ('admin', 'Admin', 'Standard admin access', true, true, 'admin'),
  ('support_admin', 'Support Admin', 'Support & CRM and limited sections', true, true, 'admin')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_system_role = true,
  is_active = true,
  role_type = 'admin',
  updated_at = NOW();

-- 4. All admin permission codes (used for super_admin; others get subset)
-- resource/action for role_permissions: we use permission_name = full code, resource = '*', action = '*'
DO $$
DECLARE
  super_id UUID;
  admin_id UUID;
  support_id UUID;
  perms TEXT[] := ARRAY[
    'admin:analytics:view', 'admin:enterprise:view', 'admin:enterprise:edit',
    'admin:vendors:view', 'admin:vendors:approve', 'admin:vendors:reject',
    'admin:ecommerce:view', 'admin:ecommerce:edit', 'admin:regions:view', 'admin:regions:edit',
    'admin:marketing:view', 'admin:marketing:edit', 'admin:loyalty:view', 'admin:loyalty:edit',
    'admin:support:view', 'admin:support:edit', 'admin:catalog:view', 'admin:catalog:edit',
    'admin:finance:view', 'admin:finance:edit', 'admin:roles:view', 'admin:roles:edit',
    'admin:users:view', 'admin:users:create', 'admin:users:edit', 'admin:users:reset_password',
    'admin:platform_settings:view', 'admin:platform_settings:edit', 'admin:reports:view',
    'admin:audit:view', 'admin:events:view', 'admin:events:edit', 'admin:content:view', 'admin:content:edit',
    'admin:pet_info:view', 'admin:pet_info:edit'
  ];
  p TEXT;
BEGIN
  SELECT id INTO super_id FROM roles WHERE name = 'super_admin' LIMIT 1;
  SELECT id INTO admin_id FROM roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO support_id FROM roles WHERE name = 'support_admin' LIMIT 1;

  IF super_id IS NOT NULL THEN
    FOREACH p IN ARRAY perms LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      VALUES (super_id, p, '*', '*')
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END IF;

  -- admin: same as super_admin (can restrict later)
  IF admin_id IS NOT NULL THEN
    FOREACH p IN ARRAY perms LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      VALUES (admin_id, p, '*', '*')
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END IF;

  -- support_admin: support, audit, reports, users view
  IF support_id IS NOT NULL THEN
    FOREACH p IN ARRAY ARRAY['admin:support:view', 'admin:support:edit', 'admin:audit:view', 'admin:reports:view', 'admin:users:view', 'admin:analytics:view'] LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      VALUES (support_id, p, '*', '*')
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 5. Assign existing admins to super_admin if they have no admin_role_id
UPDATE admins a
SET admin_role_id = (SELECT id FROM roles WHERE name = 'super_admin' AND role_type = 'admin' LIMIT 1)
WHERE a.admin_role_id IS NULL;

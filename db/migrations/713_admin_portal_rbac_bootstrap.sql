-- ============================================================================
-- Migration 713: Admin portal RBAC — admin_master role + master admin link
-- ============================================================================
-- Ensures role `admin_master` exists with all admin.* permissions and assigns
-- it to master admin f0ed5fb7-7bfd-4080-a939-a6cd58e06017 via user_roles.
-- Idempotent: safe to run multiple times.
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.dashboard',
    'admin.analytics',
    'admin.vendors',
    'admin.catalog',
    'admin.settlements',
    'admin.reports',
    'admin.integrations',
    'admin.governance',
    'admin.logistics',
    'admin.refunds',
    'admin.support',
    'admin.events',
    'admin.ecommerce',
    'admin.platform_settings',
    'admin.roles',
    'admin.full_access'
  ];
BEGIN
  INSERT INTO roles (name, display_name, description, is_system_role, is_active, created_at, updated_at)
  VALUES (
    'admin_master',
    'Admin (Full Access)',
    'Full admin portal access including RBAC',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_system_role = true,
    is_active = true,
    updated_at = NOW()
  RETURNING id INTO rid;

  IF rid IS NULL THEN
    SELECT id INTO rid FROM roles WHERE name = 'admin_master' LIMIT 1;
  END IF;

  FOREACH perm IN ARRAY perms LOOP
    INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
    VALUES (rid, perm, '*', '*', NOW())
    ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
  END LOOP;

  INSERT INTO user_roles (user_id, role_id, assigned_by, is_active, created_at, updated_at)
  VALUES (
    'f0ed5fb7-7bfd-4080-a939-a6cd58e06017'::uuid,
    rid,
    'f0ed5fb7-7bfd-4080-a939-a6cd58e06017'::uuid,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    is_active = true,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = NOW();
END $$;

-- ============================================================================
-- 720: Local / dev master admin login (admin@warmpawz.com)
-- ============================================================================
-- Password: warmpawz2025 — PBKDF2-SHA512 10000 iterations, 64-byte hash,
-- format salt:hexdigest (same as admin-comprehensive hashPassword / comparePassword).
-- Idempotent. Does not remove other admins.
-- Also ensures 713-style admin_master + user_roles for the master UUID when
-- roles tables exist (RBAC UI).
-- ============================================================================

-- PBKDF2 verified: password warmpawz2025, salt deadbeefcafebabe1122334455667788
INSERT INTO admins (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'f0ed5fb7-7bfd-4080-a939-a6cd58e06017'::uuid,
  'admin@warmpawz.com',
  'Master Admin',
  'deadbeefcafebabe1122334455667788:f7eec4f52cd9050c723765cf7a229137cc31f88dec9ba189c66baaca0efd11f6814e903c1f0c50b6907f788e5e4c479b8f1a466a589e67dc42904380e844cc8c',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = COALESCE(NULLIF(EXCLUDED.name, ''), admins.name),
  is_active = true,
  updated_at = NOW();

-- 713 equivalent: admin_master role + permissions + user_roles(master id)
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    RETURN;
  END IF;

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

  IF rid IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
    FOREACH perm IN ARRAY perms LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
      VALUES (rid, perm, '*', '*', NOW())
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
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
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 1025: Admin notification engine permissions
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.notifications.view',
    'admin.notifications.create',
    'admin.notifications.edit',
    'admin.notifications.approve',
    'admin.notifications.send',
    'admin.notifications.analytics'
  ];
BEGIN
  SELECT id INTO rid FROM roles WHERE name = 'admin_master' LIMIT 1;

  FOREACH perm IN ARRAY perms LOOP
    IF rid IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
      VALUES (rid, perm, '*', '*', NOW())
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END IF;
  END LOOP;
END $$;

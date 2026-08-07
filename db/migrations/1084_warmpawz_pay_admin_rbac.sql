-- ============================================================================
-- Migration 1084: Warmpawz Pay admin RBAC permissions
-- ============================================================================
-- Grants admin.warmpawz_pay (+ catalogue granular permissions) to admin_master
-- and any role that already has admin.full_access. Idempotent.
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.warmpawz_pay',
    'admin.warmpawz_pay.catalogue.view',
    'admin.warmpawz_pay.catalogue.create',
    'admin.warmpawz_pay.catalogue.delete',
    'admin.warmpawz_pay.catalogue.publish',
    'admin.warmpawz_pay.catalogue.unpublish',
    'admin.warmpawz_pay.catalogue.bulk'
  ];
BEGIN
  FOR rid IN
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    WHERE rp.permission_name IN ('admin.full_access', 'admin.warmpawz_pay')
    UNION
    SELECT r.id FROM roles r WHERE r.name = 'admin_master' AND r.is_active = true
  LOOP
    FOREACH perm IN ARRAY perms LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
      VALUES (rid, perm, '*', '*', NOW())
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

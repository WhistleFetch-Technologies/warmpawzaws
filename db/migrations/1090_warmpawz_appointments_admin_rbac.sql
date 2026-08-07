-- ============================================================================
-- Migration 1090: Warmpawz Appointments admin RBAC permissions
-- ============================================================================
-- Grants admin.warmpawz_appointments (+ catalogue granular permissions) to
-- admin_master and roles with admin.full_access. Idempotent.
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.warmpawz_appointments',
    'admin.warmpawz_appointments.catalogue.view',
    'admin.warmpawz_appointments.catalogue.create',
    'admin.warmpawz_appointments.catalogue.delete',
    'admin.warmpawz_appointments.catalogue.publish',
    'admin.warmpawz_appointments.catalogue.unpublish',
    'admin.warmpawz_appointments.catalogue.bulk',
    'admin.warmpawz_appointments.catalogue.fee.write'
  ];
BEGIN
  FOR rid IN
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    WHERE rp.permission_name IN ('admin.full_access', 'admin.warmpawz_appointments')
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

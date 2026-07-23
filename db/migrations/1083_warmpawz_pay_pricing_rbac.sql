-- ============================================================================
-- Migration 1083: Warmpawz Pay pricing admin RBAC permissions
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.warmpawz_pay.pricing.view',
    'admin.warmpawz_pay.pricing.write',
    'admin.warmpawz_pay.merchants.view',
    'admin.warmpawz_pay.dashboard.view'
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

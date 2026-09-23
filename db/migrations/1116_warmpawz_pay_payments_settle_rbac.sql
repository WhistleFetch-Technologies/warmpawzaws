-- ============================================================================
-- Migration 1116: Warmpawz Pay payments settle RBAC
-- Dedicated permission for marking Pay Bill vendor payouts settled
-- (list/export remain on admin.warmpawz_pay.dashboard.view).
-- ============================================================================

DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.warmpawz_pay.payments.settle'
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

-- ============================================================================
-- Migration 1128: Warmpawz Insurance admin permissions
-- ============================================================================
-- Same grant pattern as 1093. No DO $$ block (RDS Data API splits on semicolons).
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
SELECT roles.rid, perms.perm, '*', '*', NOW()
FROM (
  SELECT DISTINCT rp.role_id AS rid
  FROM role_permissions rp
  WHERE rp.permission_name IN ('admin.full_access', 'admin.warmpawz_insurance')
  UNION
  SELECT r.id AS rid FROM roles r WHERE r.name = 'admin_master' AND r.is_active = true
) roles
CROSS JOIN (
  VALUES
    ('admin.warmpawz_insurance'),
    ('admin.warmpawz_insurance.view'),
    ('admin.warmpawz_insurance.companies.write'),
    ('admin.warmpawz_insurance.payouts.write')
) AS perms(perm)
ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;

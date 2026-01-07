-- ============================================================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migrations 050 and 051 to verify success
-- ============================================================================

-- 1. Verify all 20 roles have form schemas
SELECT 
  name,
  display_name,
  CASE 
    WHEN config->'onboardingFields' IS NULL THEN '❌ Missing Schema'
    WHEN config->'onboardingFields'->'fields' IS NULL THEN '❌ No Fields'
    WHEN jsonb_array_length(config->'onboardingFields'->'fields') = 0 THEN '❌ Empty Fields'
    ELSE '✅ Complete'
  END as schema_status,
  jsonb_array_length(config->'onboardingFields'->'fields') as field_count
FROM roles 
WHERE is_active = true
ORDER BY name;

-- Expected: All 20 roles should show "✅ Complete" with field_count > 0

-- 2. Verify all 20 roles have permissions
SELECT 
  r.name,
  r.display_name,
  COUNT(rp.id) as permission_count,
  CASE 
    WHEN COUNT(rp.id) = 0 THEN '❌ No Permissions'
    WHEN COUNT(rp.id) < 3 THEN '⚠️  Few Permissions'
    ELSE '✅ Has Permissions'
  END as permission_status
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_active = true
GROUP BY r.id, r.name, r.display_name
ORDER BY r.name;

-- Expected: All 20 roles should have permission_count > 0

-- 3. Summary check
SELECT 
  COUNT(*) FILTER (WHERE config->'onboardingFields'->'fields' IS NOT NULL 
                   AND jsonb_array_length(config->'onboardingFields'->'fields') > 0) as roles_with_schemas,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id
  )) as roles_with_permissions,
  COUNT(*) as total_active_roles
FROM roles
WHERE is_active = true;

-- Expected: 
-- roles_with_schemas: 20
-- roles_with_permissions: 20
-- total_active_roles: 20

-- 4. Sample role verification (Veterinarian)
SELECT 
  name,
  config->'onboardingFields'->'sections' as sections,
  jsonb_array_length(config->'onboardingFields'->'fields') as field_count,
  (SELECT COUNT(*) FROM role_permissions WHERE role_id = roles.id) as permission_count
FROM roles
WHERE name = 'veterinarian';

-- Expected: field_count > 10, permission_count > 0


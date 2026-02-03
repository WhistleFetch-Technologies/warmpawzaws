-- ============================================================================
-- Verify Service Catalog: Three Mandatory Fields
-- ============================================================================
-- Run against RDS to ensure every active service has:
-- 1. applicable_roles (non-empty array)
-- 2. service_style (one of at_center, at_home, tele, all)
-- 3. specialization_ids (array; may be empty '{}')
-- ============================================================================

-- Services missing any of the three mandatory fields (active/published only)
SELECT
  id,
  service_id,
  service_name,
  category_id,
  applicable_roles,
  service_style,
  COALESCE(specialization_ids, ARRAY[]::text[]) AS specialization_ids,
  CASE WHEN applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL THEN 'MISSING' ELSE 'OK' END AS applicable_roles_status,
  CASE WHEN service_style IS NULL OR service_style NOT IN ('at_center','at_home','tele','all') THEN 'MISSING/INVALID' ELSE 'OK' END AS service_style_status,
  CASE WHEN specialization_ids IS NULL THEN 'MISSING' ELSE 'OK' END AS specialization_ids_status
FROM service_catalog
WHERE status = 'active'
  AND (publish_status = 'published' OR publish_status IS NULL)
  AND (
    applicable_roles IS NULL
    OR array_length(applicable_roles, 1) IS NULL
    OR service_style IS NULL
    OR service_style NOT IN ('at_center', 'at_home', 'tele', 'all')
    OR specialization_ids IS NULL
  )
ORDER BY category_id, service_name;

-- Summary counts
SELECT
  COUNT(*) FILTER (WHERE applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL) AS missing_applicable_roles,
  COUNT(*) FILTER (WHERE service_style IS NULL OR service_style NOT IN ('at_center','at_home','tele','all')) AS missing_or_invalid_service_style,
  COUNT(*) FILTER (WHERE specialization_ids IS NULL) AS missing_specialization_ids,
  COUNT(*) AS total_active_published
FROM service_catalog
WHERE status = 'active'
  AND (publish_status = 'published' OR publish_status IS NULL);

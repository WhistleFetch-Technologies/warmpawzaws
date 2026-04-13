-- ============================================================================
-- MIGRATION 625: Sync specialization_master.allowed_service_styles from catalog
-- ============================================================================
-- Purpose:
--   1) Copy styles from problem_grid_mappings (per migration 411 rules) where
--      specialization_id = problem_id (deterministic row: DISTINCT ON problem_id).
--   2) For rows still NULL or still the default triple [at_home, at_center, tele],
--      apply category-based defaults.
--   3) Force facility-only styles for surgery / emergency / lab-style ids.
--
-- Verification (run after apply):
--   SELECT COUNT(*) FROM specialization_master sm
--     WHERE LOWER(sm.category_id) = 'grooming' AND sm.allowed_service_styles ? 'tele';
--   → expect 0
--
--   SELECT specialization_id, allowed_service_styles FROM specialization_master
--     WHERE specialization_id ILIKE '%surgery%' OR specialization_id ILIKE '%emergency%';
--   → expect only ["at_center"] where tertiary matched
--
-- Spot-check: GET /public/problem-grid — allowedServiceStyles per item.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Primary: problem_grid_mappings → specialization_master
-- ---------------------------------------------------------------------------
WITH mapping_pick AS (
  SELECT DISTINCT ON (problem_id)
    problem_id,
    allowed_service_styles
  FROM public.problem_grid_mappings
  WHERE allowed_service_styles IS NOT NULL
    AND jsonb_typeof(allowed_service_styles) = 'array'
    AND jsonb_array_length(allowed_service_styles) > 0
  ORDER BY problem_id, role_id NULLS LAST, sub_category_id NULLS LAST
)
UPDATE public.specialization_master sm
SET
  allowed_service_styles = mp.allowed_service_styles,
  updated_at = NOW()
FROM mapping_pick mp
WHERE sm.specialization_id = mp.problem_id;

-- ---------------------------------------------------------------------------
-- 2) Secondary: category defaults when NULL or still default-all-three
--    Default triple = exactly those three values (any order), length 3
-- ---------------------------------------------------------------------------
UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home", "at_center"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('grooming')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('walking')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_center"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('boarding')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home", "at_center"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('training')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_center"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('diagnostic', 'diagnostics')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('behavioral', 'behaviour', 'behavior')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN ('wellness', 'nutrition', 'pharmacy')
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb, updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(sm.category_id, ''))) IN (
    'veterinary',
    'vet',
    'emergency',
    'specialty'
  )
  AND (
    sm.allowed_service_styles IS NULL
    OR (
      jsonb_typeof(sm.allowed_service_styles) = 'array'
      AND jsonb_array_length(sm.allowed_service_styles) = 3
      AND sm.allowed_service_styles ? 'tele'
      AND sm.allowed_service_styles ? 'at_home'
      AND sm.allowed_service_styles ? 'at_center'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Tertiary: facility-only overrides (wins over category tele/home)
-- ---------------------------------------------------------------------------
UPDATE public.specialization_master sm
SET allowed_service_styles = '["at_center"]'::jsonb, updated_at = NOW()
WHERE COALESCE(sm.is_active, true) = true
  AND (
    sm.specialization_id ILIKE '%surgery%'
    OR sm.specialization_id ILIKE '%emergency%'
    OR sm.specialization_id ILIKE '%orthopedic%'
    OR sm.specialization_id ILIKE '%orthopaedic%'
    OR sm.specialization_id ILIKE '%cancer%'
    OR sm.specialization_id ILIKE '%oncology%'
    OR sm.specialization_id ILIKE '%imaging%'
    OR sm.specialization_id ILIKE '%radiology%'
    OR sm.specialization_id ILIKE '%pathology%'
    OR sm.specialization_id ILIKE '%ultrasound%'
    OR sm.specialization_id ILIKE '%laboratory%'
    OR sm.specialization_id ILIKE 'lab_%'
    OR sm.specialization_id ILIKE '%_lab_%'
    OR sm.specialization_id ILIKE '%pet_lab%'
    OR sm.specialization_id ~* '(^|_)(diagnostics?|ct_?scan)(_|$)'
    OR sm.specialization_id ~* '(^|_)mri(_|$)'
  );

COMMIT;

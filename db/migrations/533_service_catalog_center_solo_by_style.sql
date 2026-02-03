-- ============================================================================
-- Migration 533: Service catalog – center vs solo by service_style
-- ============================================================================
-- Purpose: Map services by style so discovery is dynamic from service_catalog only:
--   - at_center services → business/center roles only (vet_clinic, groomer_center, trainer_center, behaviorist_center)
--   - at_home / tele services → solo roles only (vet_solo, groomer_solo, trainer_solo, behaviorist_solo)
--   - service_style = 'all' or NULL → keep both solo and center for that domain
-- Same specializations for solo and center; discovery uses applicable_roles + service_style from DB.
-- Date: 2026-02-03
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. VET: at_center → vet_clinic (+ veterinarian); at_home/tele → vet_solo (+ veterinarian)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = COALESCE(
  (SELECT array_agg(x ORDER BY x) FROM unnest(applicable_roles) AS x
   WHERE x::text NOT IN ('vet_clinic','vet_solo','veterinarian','veterinary_clinic')),
  ARRAY[]::text[]
)
|| CASE
  WHEN service_style = 'at_center' THEN ARRAY['vet_clinic','veterinarian']::text[]
  WHEN service_style IN ('at_home','tele') THEN ARRAY['vet_solo','veterinarian']::text[]
  ELSE ARRAY['vet_clinic','vet_solo','veterinarian']::text[]
END,
updated_at = NOW()
WHERE applicable_roles && ARRAY['vet_clinic','vet_solo','veterinarian','veterinary_clinic']::text[]
  AND status = 'active';

-- ============================================================================
-- 2. GROOMER: at_center → groomer_center (+ pet_groomer); at_home/tele → groomer_solo (+ pet_groomer)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = COALESCE(
  (SELECT array_agg(x ORDER BY x) FROM unnest(applicable_roles) AS x
   WHERE x::text NOT IN ('groomer_center','groomer_solo','pet_groomer','groomer','pet_spa')),
  ARRAY[]::text[]
)
|| CASE
  WHEN service_style = 'at_center' THEN ARRAY['groomer_center','pet_groomer']::text[]
  WHEN service_style IN ('at_home','tele') THEN ARRAY['groomer_solo','pet_groomer']::text[]
  ELSE ARRAY['groomer_center','groomer_solo','pet_groomer']::text[]
END,
updated_at = NOW()
WHERE applicable_roles && ARRAY['groomer_center','groomer_solo','pet_groomer','groomer','pet_spa']::text[]
  AND status = 'active';

-- ============================================================================
-- 3. TRAINER: at_center → trainer_center (+ pet_trainer); at_home/tele → trainer_solo (+ pet_trainer)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = COALESCE(
  (SELECT array_agg(x ORDER BY x) FROM unnest(applicable_roles) AS x
   WHERE x::text NOT IN ('trainer_center','trainer_solo','pet_trainer','trainer')),
  ARRAY[]::text[]
)
|| CASE
  WHEN service_style = 'at_center' THEN ARRAY['trainer_center','pet_trainer']::text[]
  WHEN service_style IN ('at_home','tele') THEN ARRAY['trainer_solo','pet_trainer']::text[]
  ELSE ARRAY['trainer_center','trainer_solo','pet_trainer']::text[]
END,
updated_at = NOW()
WHERE applicable_roles && ARRAY['trainer_center','trainer_solo','pet_trainer','trainer']::text[]
  AND status = 'active';

-- ============================================================================
-- 4. BEHAVIORIST: at_center → behaviorist_center (+ pet_behaviorist); at_home/tele → behaviorist_solo (+ pet_behaviorist)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = COALESCE(
  (SELECT array_agg(x ORDER BY x) FROM unnest(applicable_roles) AS x
   WHERE x::text NOT IN ('behaviorist_center','behaviorist_solo','pet_behaviorist','behaviorist')),
  ARRAY[]::text[]
)
|| CASE
  WHEN service_style = 'at_center' THEN ARRAY['behaviorist_center','pet_behaviorist']::text[]
  WHEN service_style IN ('at_home','tele') THEN ARRAY['behaviorist_solo','pet_behaviorist']::text[]
  ELSE ARRAY['behaviorist_center','behaviorist_solo','pet_behaviorist']::text[]
END,
updated_at = NOW()
WHERE applicable_roles && ARRAY['behaviorist_center','behaviorist_solo','pet_behaviorist','behaviorist']::text[]
  AND status = 'active';

-- ============================================================================
-- 5. Role config: behaviorist_solo = at_home + tele only (no at_center)
-- ============================================================================
UPDATE roles
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{serviceStyles}',
  '["at_home", "tele", "online"]'::jsonb
),
updated_at = NOW()
WHERE name = 'behaviorist_solo';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 533: service_catalog center/solo by service_style (vet, groomer, trainer, behaviorist) applied';
END $$;

COMMIT;

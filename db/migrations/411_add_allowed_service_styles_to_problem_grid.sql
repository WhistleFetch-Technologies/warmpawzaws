-- ============================================================================
-- MIGRATION 411: Add allowed_service_styles to problem_grid_mappings
-- ============================================================================
-- Purpose: Add allowed_service_styles column to specify which service styles
--          are valid for each problem (at_home, at_center, tele)
-- Date: 2026-01-27
-- ============================================================================

BEGIN;

-- Add allowed_service_styles column with default for all three styles
ALTER TABLE problem_grid_mappings
ADD COLUMN IF NOT EXISTS allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN problem_grid_mappings.allowed_service_styles IS 
  'JSON array specifying which service styles are valid for this problem. Values: at_home, at_center, tele';

-- Create index for efficient querying by service style
CREATE INDEX IF NOT EXISTS idx_problem_grid_allowed_styles 
  ON problem_grid_mappings USING GIN (allowed_service_styles);

-- ============================================================================
-- UPDATE EXISTING DATA WITH APPROPRIATE SERVICE STYLES
-- ============================================================================

-- GROOMING problems: at_home and at_center only (no tele)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center"]'::jsonb
WHERE role_id = 'groomer'
   OR problem_id ILIKE '%groom%'
   OR problem_id ILIKE '%bath%'
   OR problem_id ILIKE '%nail%'
   OR problem_id ILIKE '%deshed%'
   OR problem_id ILIKE '%spa%'
   OR problem_id ILIKE '%haircut%';

-- WALKER problems: at_home only (walking happens at customer location)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home"]'::jsonb
WHERE role_id = 'walker'
   OR problem_id ILIKE '%walk%'
   OR problem_id ILIKE '%daily_walk%'
   OR problem_id ILIKE '%puppy_walk%'
   OR problem_id ILIKE '%senior_walk%'
   OR problem_id ILIKE '%long_walk%';

-- VET problems: all three styles available
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb
WHERE role_id = 'veterinarian'
   OR problem_id ILIKE '%health%'
   OR problem_id ILIKE '%vaccination%'
   OR problem_id ILIKE '%checkup%'
   OR problem_id ILIKE '%dental%'
   OR problem_id ILIKE '%derma%'
   OR problem_id ILIKE '%eye%'
   OR problem_id ILIKE '%ear%'
   OR problem_id ILIKE '%digestive%'
   OR problem_id ILIKE '%respiratory%'
   OR problem_id ILIKE '%cardiac%'
   OR problem_id ILIKE '%neuro%';

-- SURGERY/EMERGENCY problems: at_center only (requires clinic facilities)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_center"]'::jsonb
WHERE problem_id ILIKE '%surgery%'
   OR problem_id ILIKE '%emergency%'
   OR problem_id ILIKE '%orthopedic%'
   OR problem_id ILIKE '%cancer%';

-- TRAINING problems: at_home and at_center (no tele for hands-on training)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center"]'::jsonb
WHERE role_id = 'trainer'
   OR problem_id ILIKE '%training%'
   OR problem_id ILIKE '%obedience%'
   OR problem_id ILIKE '%potty%'
   OR problem_id ILIKE '%socialization%'
   OR problem_id ILIKE '%leash%'
   OR problem_id ILIKE '%aggression%';

-- BEHAVIORAL problems: all three (consultations can be remote)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb
WHERE role_id = 'behaviourist'
   OR problem_id ILIKE '%anxiety%'
   OR problem_id ILIKE '%barking%'
   OR problem_id ILIKE '%destructive%'
   OR problem_id ILIKE '%fear%'
   OR problem_id ILIKE '%phobia%'
   OR problem_id ILIKE '%behavior%';

-- BOARDING problems: at_center only (pet stays at facility)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_center"]'::jsonb
WHERE role_id = 'boarding'
   OR problem_id ILIKE '%boarding%'
   OR problem_id ILIKE '%daycare%'
   OR problem_id ILIKE '%stay%'
   OR problem_id ILIKE '%hotel%';

-- NUTRITION problems: all three styles (consultations can be remote)
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb
WHERE role_id = 'nutritionist'
   OR problem_id ILIKE '%nutrition%'
   OR problem_id ILIKE '%diet%'
   OR problem_id ILIKE '%weight%'
   OR problem_id ILIKE '%food%'
   OR problem_id ILIKE '%allerg%';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    total_count INTEGER;
    with_styles_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM problem_grid_mappings;
    SELECT COUNT(*) INTO with_styles_count 
    FROM problem_grid_mappings 
    WHERE allowed_service_styles IS NOT NULL 
      AND jsonb_array_length(allowed_service_styles) > 0;
    
    RAISE NOTICE '✅ Migration 411 complete: % of % records have allowed_service_styles set', 
        with_styles_count, total_count;
END $$;

COMMIT;

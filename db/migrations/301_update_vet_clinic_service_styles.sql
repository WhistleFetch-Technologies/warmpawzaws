-- ============================================================================
-- MIGRATION 301: UPDATE VET_CLINIC ROLE TO ALLOW ALL SERVICE STYLES
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Update vet_clinic (business) role to allow at_center, at_home, and tele services
--          Previously only at_center was allowed, but business clinics should be able
--          to offer all three service styles like veterinarian role
-- ============================================================================

BEGIN;

-- Update vet_clinic role to allow all three service styles
UPDATE roles 
SET 
  config = jsonb_set(
    config, 
    '{serviceStyles}', 
    '["at_center", "at_home", "tele"]'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'vet_clinic' AND is_active = true;

-- Verify the update
DO $$
DECLARE
  updated_count INTEGER;
  current_styles JSONB;
BEGIN
  SELECT COUNT(*)
  INTO updated_count
  FROM roles 
  WHERE name = 'vet_clinic' AND is_active = true;
  
  SELECT config->'serviceStyles'
  INTO current_styles
  FROM roles 
  WHERE name = 'vet_clinic' AND is_active = true
  LIMIT 1;
  
  IF updated_count = 0 THEN
    RAISE WARNING 'No vet_clinic role found to update';
  ELSIF current_styles::text != '["at_center", "at_home", "tele"]' THEN
    RAISE WARNING 'Service styles update may have failed. Current: %', current_styles;
  ELSE
    RAISE NOTICE '✅ Successfully updated vet_clinic role to allow all three service styles';
  END IF;
END $$;

COMMIT;

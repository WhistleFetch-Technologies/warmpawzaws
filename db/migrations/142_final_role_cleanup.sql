-- ============================================================================
-- MIGRATION 142: FINAL ROLE CLEANUP
-- ============================================================================
-- Date: 2026-01-17
-- Purpose: Final cleanup to mark remaining duplicate roles as inactive
-- ============================================================================

BEGIN;

-- Mark remaining duplicate roles as inactive
UPDATE roles SET 
  is_active = false,
  updated_at = NOW()
WHERE is_active = true
  AND name IN (
    -- Duplicates that should be inactive
    'pet_ambulance',      -- duplicate of 'ambulance'
    'pet_shelter',        -- duplicate of 'adoption_center'
    'pet_taxi',           -- duplicate of 'relocation'
    'pet_transport'       -- duplicate of 'relocation'
  )
  AND EXISTS (
    SELECT 1 FROM roles r2 
    WHERE r2.is_active = true 
      AND (
        (roles.name = 'pet_ambulance' AND r2.name = 'ambulance')
        OR (roles.name = 'pet_shelter' AND r2.name = 'adoption_center')
        OR (roles.name IN ('pet_taxi', 'pet_transport') AND r2.name = 'relocation')
      )
  );

-- Verify: Count active roles
-- SELECT COUNT(*) as active_roles FROM roles WHERE is_active = true;
-- Expected: ~21-24 roles

COMMIT;

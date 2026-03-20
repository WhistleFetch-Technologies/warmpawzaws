-- ============================================================================
-- MIGRATION 141: COMPLETE ROLE CONSOLIDATION CLEANUP
-- ============================================================================
-- Date: 2026-01-17
-- Purpose: Complete the role consolidation by marking old/duplicate roles as inactive
--          and ensuring all active roles have customer_service assigned
-- ============================================================================
-- This migration:
-- 1. Marks old/duplicate roles as inactive
-- 2. Ensures all active roles have customer_service assigned
-- 3. Maps old roles to customer_service where appropriate
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Mark old/duplicate roles as inactive
-- ============================================================================

-- Mark old pet_* prefixed roles as inactive (if consolidated versions exist)
DO $$
DECLARE
  old_role_name TEXT;
  new_role_name TEXT;
BEGIN
  -- pet_groomer -> groomer_solo/groomer_center
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_groomer' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name IN ('groomer_solo', 'groomer_center') AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_groomer' AND is_active = true;
    END IF;
  END IF;

  -- pet_trainer -> trainer_solo/trainer_center
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_trainer' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name IN ('trainer_solo', 'trainer_center') AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_trainer' AND is_active = true;
    END IF;
  END IF;

  -- pet_walker -> walker (if walker exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_walker' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'walker' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_walker' AND is_active = true;
    END IF;
  END IF;

  -- pet_sitter -> sitter (if sitter exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_sitter' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'sitter' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_sitter' AND is_active = true;
    END IF;
  END IF;

  -- pet_boarding, pet_daycare -> boarding (if boarding exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name IN ('pet_boarding', 'pet_daycare') AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'boarding' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name IN ('pet_boarding', 'pet_daycare') AND is_active = true;
    END IF;
  END IF;

  -- pet_insurance -> insurance (if insurance exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_insurance' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'insurance' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_insurance' AND is_active = true;
    END IF;
  END IF;

  -- pet_nutritionist -> nutritionist (if nutritionist exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_nutritionist' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'nutritionist' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_nutritionist' AND is_active = true;
    END IF;
  END IF;

  -- pet_photographer -> photographer (if photographer exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_photographer' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'photographer' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_photographer' AND is_active = true;
    END IF;
  END IF;

  -- pet_resort -> resort (if resort exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_resort' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'resort' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_resort' AND is_active = true;
    END IF;
  END IF;

  -- pet_breeder -> breeder (if breeder exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_breeder' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'breeder' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_breeder' AND is_active = true;
    END IF;
  END IF;

  -- pet_adoption_center -> adoption_center (if adoption_center exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_adoption_center' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'adoption_center' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_adoption_center' AND is_active = true;
    END IF;
  END IF;

  -- pet_cafe -> cafe (if cafe exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_cafe' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'cafe' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_cafe' AND is_active = true;
    END IF;
  END IF;

  -- pet_relocation -> relocation (if relocation exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_relocation' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'relocation' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_relocation' AND is_active = true;
    END IF;
  END IF;

  -- pet_sunset_services -> sunset (if sunset exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_sunset_services' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'sunset' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_sunset_services' AND is_active = true;
    END IF;
  END IF;

  -- pet_pharmacy -> pharmacy (if pharmacy exists and is different)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_pharmacy' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'pharmacy' AND is_active = true AND name != 'pet_pharmacy') THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_pharmacy' AND is_active = true;
    END IF;
  END IF;

  -- pet_products_store -> seller (if seller exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_products_store' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'seller' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_products_store' AND is_active = true;
    END IF;
  END IF;

  -- veterinary_clinic -> vet_clinic (if vet_clinic exists)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'veterinary_clinic' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'vet_clinic' AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'veterinary_clinic' AND is_active = true;
    END IF;
  END IF;

  -- pet_event_organizer -> event_organizer (keep event_organizer if it exists, or mark pet_* as inactive)
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_event_organizer' AND is_active = true) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'event_organizer' AND is_active = true AND name != 'pet_event_organizer') THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'pet_event_organizer' AND is_active = true;
    END IF;
  END IF;

  -- Mark duplicate/old roles without customer_service (if consolidated versions exist)
  -- groomers (old) -> groomer_solo/groomer_center
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'groomers' AND is_active = true AND customer_service IS NULL) THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name IN ('groomer_solo', 'groomer_center') AND is_active = true) THEN
      UPDATE roles SET is_active = false, updated_at = NOW() 
      WHERE name = 'groomers' AND is_active = true;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Assign customer_service to roles that don't have it
-- ============================================================================

-- Map old roles to customer_service based on their names/config
UPDATE roles SET 
  customer_service = CASE
    WHEN name LIKE '%vet%' OR name LIKE '%veterinarian%' OR name LIKE '%veterinary%' THEN 'vet'
    WHEN name LIKE '%groom%' THEN 'grooming'
    WHEN name LIKE '%train%' THEN 'training'
    WHEN name LIKE '%walk%' THEN 'walker'
    WHEN name LIKE '%sit%' THEN 'sitter'
    WHEN name LIKE '%board%' OR name LIKE '%daycare%' THEN 'boarding'
    WHEN name LIKE '%adopt%' OR name LIKE '%shelter%' THEN 'adoption'
    WHEN name LIKE '%cafe%' THEN 'cafes'
    WHEN name LIKE '%photo%' THEN 'photography'
    WHEN name LIKE '%insur%' THEN 'insurance'
    WHEN name LIKE '%breed%' THEN 'breeder'
    WHEN name LIKE '%ambulance%' THEN 'ambulance'
    WHEN name LIKE '%nutrition%' THEN 'nutritionist'
    WHEN name LIKE '%relocat%' OR name LIKE '%transport%' OR name LIKE '%taxi%' THEN 'relocation'
    WHEN name LIKE '%resort%' THEN 'resort'
    WHEN name LIKE '%holiday%' THEN 'holiday'
    WHEN name LIKE '%sunset%' THEN 'sunset'
    WHEN name LIKE '%pharmacy%' OR name LIKE '%pharma%' THEN 'shop'
    WHEN name LIKE '%seller%' OR name LIKE '%store%' OR name LIKE '%products%' THEN 'shop'
    WHEN name LIKE '%event%' THEN NULL -- Events don't map to a customer service
    WHEN name LIKE '%diagnostic%' THEN NULL -- Diagnostics don't map to a customer service
    WHEN name LIKE '%behavior%' THEN NULL -- Behaviorist doesn't map to a customer service
    WHEN name LIKE '%spa%' THEN NULL -- Spa doesn't map to a customer service
    ELSE NULL
  END,
  updated_at = NOW()
WHERE customer_service IS NULL 
  AND is_active = true
  AND customer_service IS DISTINCT FROM CASE
    WHEN name LIKE '%vet%' OR name LIKE '%veterinarian%' OR name LIKE '%veterinary%' THEN 'vet'
    WHEN name LIKE '%groom%' THEN 'grooming'
    WHEN name LIKE '%train%' THEN 'training'
    WHEN name LIKE '%walk%' THEN 'walker'
    WHEN name LIKE '%sit%' THEN 'sitter'
    WHEN name LIKE '%board%' OR name LIKE '%daycare%' THEN 'boarding'
    WHEN name LIKE '%adopt%' OR name LIKE '%shelter%' THEN 'adoption'
    WHEN name LIKE '%cafe%' THEN 'cafes'
    WHEN name LIKE '%photo%' THEN 'photography'
    WHEN name LIKE '%insur%' THEN 'insurance'
    WHEN name LIKE '%breed%' THEN 'breeder'
    WHEN name LIKE '%ambulance%' THEN 'ambulance'
    WHEN name LIKE '%nutrition%' THEN 'nutritionist'
    WHEN name LIKE '%relocat%' OR name LIKE '%transport%' OR name LIKE '%taxi%' THEN 'relocation'
    WHEN name LIKE '%resort%' THEN 'resort'
    WHEN name LIKE '%holiday%' THEN 'holiday'
    WHEN name LIKE '%sunset%' THEN 'sunset'
    WHEN name LIKE '%pharmacy%' OR name LIKE '%pharma%' THEN 'shop'
    WHEN name LIKE '%seller%' OR name LIKE '%store%' OR name LIKE '%products%' THEN 'shop'
    ELSE NULL
  END;

-- ============================================================================
-- STEP 3: Mark roles without customer_service as inactive (if they're duplicates)
-- ============================================================================

-- Mark system roles without customer_service as inactive if they're duplicates
-- Keep only the ones that are unique (like event_organizer, diagnostics_center, etc.)
UPDATE roles SET 
  is_active = false,
  updated_at = NOW()
WHERE is_active = true
  AND customer_service IS NULL
  AND name IN (
    'pet_ambulance', -- duplicate of ambulance
    'pet_behaviorist', -- doesn't map to customer service
    'pet_spa', -- doesn't map to customer service
    'pet_transport' -- duplicate of relocation
  );

-- Keep these roles active even without customer_service (they're unique):
-- - event_organizer (events don't map to customer service)
-- - diagnostics_center (diagnostics don't map to customer service)
-- - pet_shelter (if adoption_center doesn't exist, keep this)

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count active roles by customer_service
-- SELECT customer_service, COUNT(*) as count
-- FROM roles 
-- WHERE is_active = true
-- GROUP BY customer_service
-- ORDER BY customer_service;

-- Count inactive roles
-- SELECT COUNT(*) as inactive_count
-- FROM roles 
-- WHERE is_active = false;

-- List roles without customer_service (should be minimal)
-- SELECT name, display_name, is_active
-- FROM roles 
-- WHERE customer_service IS NULL
-- ORDER BY is_active DESC, name;

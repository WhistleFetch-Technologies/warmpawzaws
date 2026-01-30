-- ============================================================================
-- MIGRATION 255: SERVICE CATALOG ROLE ASSIGNMENT (DISCOVERY & FIX)
-- ============================================================================
-- Purpose:
-- 1. Ensure all service_catalog rows have applicable_roles set (no NULL/empty).
-- 2. Assign multiple roles for identical services (e.g. vet_solo + vet_clinic for vet services)
--    so both solo and business vendors see the same services; filter by role on vendor side.
-- 3. Infer role from category_name/service_name when applicable_roles is missing.
-- ============================================================================

-- ============================================================================
-- STEP 1: Backfill NULL/empty applicable_roles from category and service name
-- ============================================================================

-- Veterinary: veterinarian, vet_clinic, vet_solo (so both solo and business see)
UPDATE service_catalog
SET applicable_roles = ARRAY['veterinarian', 'vet_clinic', 'vet_solo']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'veterinary' OR category_name ILIKE '%veterinar%' OR service_id LIKE 'vet_%' OR service_name ILIKE '%vet %' OR service_name ILIKE '%vaccination%' OR service_name ILIKE '%checkup%');

-- Grooming: pet_groomer, groomer_center, groomer_solo, pet_spa
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'grooming' OR category_name ILIKE '%groom%' OR service_id LIKE 'groom_%');

-- Training: pet_trainer, trainer_center, trainer_solo
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'training' OR category_name ILIKE '%train%' OR service_id LIKE 'train_%');

-- Walking: pet_walker, walker
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_walker', 'walker']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'walking' OR category_name ILIKE '%walk%' OR service_id LIKE 'walk_%');

-- Boarding / daycare / sitting: pet_boarder, boarding, pet_daycare, pet_sitter, sitter
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_boarder', 'boarding', 'pet_daycare', 'pet_sitter', 'sitter']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'boarding' OR category_name ILIKE '%board%' OR category_name ILIKE '%daycare%' OR category_name ILIKE '%sitt%' OR service_id LIKE 'board_%' OR service_id LIKE 'daycare_%' OR service_id LIKE 'sit_%');

-- Diagnostic: diagnostics_center, vet_clinic
UPDATE service_catalog
SET applicable_roles = ARRAY['diagnostics_center', 'vet_clinic', 'veterinarian']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'diagnostic' OR category_name ILIKE '%diagnostic%' OR service_id LIKE 'diag_%');

-- Emergency / ambulance: ambulance, pet_ambulance
UPDATE service_catalog
SET applicable_roles = ARRAY['ambulance', 'pet_ambulance']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'emergency' OR category_name ILIKE '%emergency%' OR category_name ILIKE '%ambulance%' OR service_id LIKE 'ambulance_%');

-- Pharmacy: pharmacy, pet_pharmacy
UPDATE service_catalog
SET applicable_roles = ARRAY['pharmacy', 'pet_pharmacy']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'pharmacy' OR category_name ILIKE '%pharmacy%' OR service_id LIKE 'pharmacy_%');

-- Nutrition: pet_nutritionist, nutritionist, nutritionist_center
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_nutritionist', 'nutritionist', 'nutritionist_center']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'wellness' OR category_name ILIKE '%nutrition%' OR service_id LIKE 'nutrition_%');

-- Photography: pet_photographer, photographer
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_photographer', 'photographer']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_id = 'specialty' AND (service_id LIKE 'photo_%' OR service_name ILIKE '%photo%'));

-- Transport / relocation: pet_transport, relocation
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_transport', 'relocation']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (service_id LIKE 'transport_%' OR service_id LIKE 'relocate_%');

-- Cafe: pet_cafe, cafe
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_cafe', 'cafe']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (service_id LIKE 'cafe_%');

-- Adoption: pet_adoption_center, adoption_center, pet_shelter
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_adoption_center', 'adoption_center', 'pet_shelter']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (service_id LIKE 'adopt_%');

-- Event: pet_event_organizer, event_organizer
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_event_organizer', 'event_organizer']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (service_id LIKE 'event_%');

-- Insurance: pet_insurance, insurance
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_insurance', 'insurance']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (service_id LIKE 'insurance_%' OR service_name ILIKE '%insurance%');

-- Resort: pet_resort, resort
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_resort', 'resort']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_name ILIKE '%resort%' OR service_name ILIKE '%resort%');

-- Breeder: pet_breeder, breeder
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_breeder', 'breeder']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_name ILIKE '%breed%');

-- Seller / retail: pet_products_store, seller
UPDATE service_catalog
SET applicable_roles = ARRAY['pet_products_store', 'seller', 'pet_store']
WHERE (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
  AND (category_name ILIKE '%retail%' OR category_name ILIKE '%store%' OR category_name ILIKE '%product%');

-- ============================================================================
-- STEP 2: Add vet_solo to all vet services (so solo vets see same as clinic)
-- ============================================================================

UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['vet_solo', 'veterinarian']))
WHERE (category_id = 'veterinary' OR category_name ILIKE '%veterinar%' OR service_id LIKE 'vet_%')
  AND NOT ('vet_solo' = ANY(applicable_roles));

-- ============================================================================
-- STEP 3: Add groomer_center / groomer_solo to grooming services
-- ============================================================================

UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['groomer_center', 'groomer_solo', 'pet_groomer']))
WHERE (category_id = 'grooming' OR category_name ILIKE '%groom%' OR service_id LIKE 'groom_%')
  AND NOT ('groomer_center' = ANY(applicable_roles));

-- ============================================================================
-- STEP 4: Add trainer_center / trainer_solo to training services
-- ============================================================================

UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['trainer_center', 'trainer_solo', 'pet_trainer']))
WHERE (category_id = 'training' OR category_name ILIKE '%train%' OR service_id LIKE 'train_%')
  AND NOT ('trainer_center' = ANY(applicable_roles));

-- ============================================================================
-- STEP 5: Add walker to walking services
-- ============================================================================

UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['walker', 'pet_walker']))
WHERE (category_id = 'walking' OR service_id LIKE 'walk_%')
  AND NOT ('walker' = ANY(applicable_roles));

-- ============================================================================
-- STEP 6: Add sitter, boarding to boarding/sitting services
-- ============================================================================

UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['sitter', 'boarding', 'pet_sitter', 'pet_boarder', 'pet_daycare']))
WHERE (category_id = 'boarding' OR service_id LIKE 'board_%' OR service_id LIKE 'daycare_%' OR service_id LIKE 'sit_%')
  AND NOT ('sitter' = ANY(applicable_roles));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM service_catalog WHERE status = 'active';
  SELECT COUNT(*) INTO null_count FROM service_catalog
  WHERE status = 'active' AND (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL);
  RAISE NOTICE 'Service catalog role assignment: % active services, % with NULL/empty applicable_roles (should be 0)', total_count, null_count;
END $$;

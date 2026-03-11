-- ============================================================================
-- MIGRATION 522: CONSOLIDATE VENDORS ON LEGACY/INACTIVE ROLES TO CANONICAL ROLES
-- ============================================================================
-- Date: 2026-01-31
-- Purpose: Migrate all vendors (and vendor_identity, vendor_onboarding_applications)
--          from legacy or inactive roles to the correct canonical active roles.
--          When ambiguous between solo and business, map to solo.
-- ============================================================================
-- Canonical active roles (catalog / roles under catalog and services):
--   vet_solo, vet_clinic, groomer_solo, groomer_center, trainer_solo, trainer_center,
--   boarding, walker, sitter, adoption_center, cafe, photographer, pharmacy, seller,
--   ambulance, insurance, nutritionist, nutritionist_center, relocation, resort,
--   holiday, sunset, breeder, diagnostics_center, event_organizer
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: MIGRATE VENDORS (legacy role → canonical role; default solo when ambiguous)
-- ============================================================================

-- Vet / healthcare
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'veterinary_clinic' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'vet_clinic' AND is_active = true LIMIT 1) IS NOT NULL;

UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'veterinarian' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1) IS NOT NULL;

UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'vet' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1) IS NOT NULL;

-- Boarding
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'boarding' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_boarder', 'pet_daycare', 'pet_boarding')) AND (SELECT id FROM roles WHERE name = 'boarding' AND is_active = true LIMIT 1) IS NOT NULL;

-- Cafe
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'cafe' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_cafe' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'cafe' AND is_active = true LIMIT 1) IS NOT NULL;

-- Groomer (default solo when ambiguous)
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'groomer_solo' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_groomer', 'pet_spa', 'grooming_salon')) AND (SELECT id FROM roles WHERE name = 'groomer_solo' AND is_active = true LIMIT 1) IS NOT NULL;

-- Trainer (default solo when ambiguous)
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'trainer_solo' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_trainer', 'pet_behaviorist', 'training_solo', 'obedience_trainer', 'dog_trainer')) AND (SELECT id FROM roles WHERE name = 'trainer_solo' AND is_active = true LIMIT 1) IS NOT NULL;

-- Walker (already consolidated in 521; include for idempotency)
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_walker', 'walker_solo', 'dog_walker')) AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;

-- Sitter
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'sitter' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_sitter', 'sitter_solo')) AND (SELECT id FROM roles WHERE name = 'sitter' AND is_active = true LIMIT 1) IS NOT NULL;

-- Photographer
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'photographer' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_photographer' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'photographer' AND is_active = true LIMIT 1) IS NOT NULL;

-- Pharmacy
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'pharmacy' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_pharmacy' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'pharmacy' AND is_active = true LIMIT 1) IS NOT NULL;

-- Ambulance
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'ambulance' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_ambulance' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'ambulance' AND is_active = true LIMIT 1) IS NOT NULL;

-- Resort
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'resort' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_resort' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'resort' AND is_active = true LIMIT 1) IS NOT NULL;

-- Breeder
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'breeder' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_breeder' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'breeder' AND is_active = true LIMIT 1) IS NOT NULL;

-- Sunset
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'sunset' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_sunset_services' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'sunset' AND is_active = true LIMIT 1) IS NOT NULL;

-- Adoption
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'adoption_center' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_shelter', 'pet_adoption_center')) AND (SELECT id FROM roles WHERE name = 'adoption_center' AND is_active = true LIMIT 1) IS NOT NULL;

-- Seller
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'seller' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_products_store' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'seller' AND is_active = true LIMIT 1) IS NOT NULL;

-- Relocation
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'relocation' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('pet_taxi', 'pet_transport', 'pet_relocation')) AND (SELECT id FROM roles WHERE name = 'relocation' AND is_active = true LIMIT 1) IS NOT NULL;

-- Nutritionist
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'nutritionist' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_nutritionist' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'nutritionist' AND is_active = true LIMIT 1) IS NOT NULL;

-- Insurance
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'insurance' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_insurance' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'insurance' AND is_active = true LIMIT 1) IS NOT NULL;

-- Event organizer
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'event_organizer' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_event_organizer' LIMIT 1) AND (SELECT id FROM roles WHERE name = 'event_organizer' AND is_active = true LIMIT 1) IS NOT NULL;

-- Diagnostics
UPDATE vendors SET role_id = (SELECT id FROM roles WHERE name = 'diagnostics_center' AND is_active = true LIMIT 1), updated_at = NOW()
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('diagnostics_solo', 'diagnostics_provider')) AND (SELECT id FROM roles WHERE name = 'diagnostics_center' AND is_active = true LIMIT 1) IS NOT NULL;

-- ============================================================================
-- STEP 2: MIGRATE vendor_identity.selected_role_id (same mapping)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_identity') THEN
    -- Vet / healthcare
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'veterinary_clinic' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('veterinarian', 'vet'));
    -- Boarding
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'boarding' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_boarder', 'pet_daycare', 'pet_boarding'));
    -- Cafe
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'cafe' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_cafe' LIMIT 1);
    -- Groomer / Trainer / Walker / Sitter
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'groomer_solo' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_groomer', 'pet_spa', 'grooming_salon'));
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'trainer_solo' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_trainer', 'pet_behaviorist', 'training_solo', 'obedience_trainer', 'dog_trainer'));
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_walker', 'walker_solo', 'dog_walker'));
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'sitter' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_sitter', 'sitter_solo'));
    -- Others
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'photographer' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_photographer' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'pharmacy' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_pharmacy' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'ambulance' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_ambulance' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'resort' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_resort' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'breeder' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_breeder' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'sunset' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_sunset_services' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'adoption_center' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_shelter', 'pet_adoption_center'));
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'seller' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_products_store' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'relocation' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('pet_taxi', 'pet_transport', 'pet_relocation'));
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'nutritionist' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_nutritionist' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'insurance' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_insurance' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'event_organizer' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'pet_event_organizer' LIMIT 1);
    UPDATE vendor_identity SET selected_role_id = (SELECT id FROM roles WHERE name = 'diagnostics_center' AND is_active = true LIMIT 1), updated_at = NOW()
    WHERE selected_role_id IN (SELECT id FROM roles WHERE name IN ('diagnostics_solo', 'diagnostics_provider'));
  END IF;
END $$;

-- ============================================================================
-- STEP 3: MIGRATE vendor_onboarding_applications.role_id (same mapping)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_onboarding_applications') THEN
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'veterinary_clinic' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'vet_solo' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('veterinarian', 'vet'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'boarding' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_boarder', 'pet_daycare', 'pet_boarding'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'cafe' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_cafe' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'groomer_solo' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_groomer', 'pet_spa', 'grooming_salon'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'trainer_solo' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_trainer', 'pet_behaviorist', 'training_solo', 'obedience_trainer', 'dog_trainer'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_walker', 'walker_solo', 'dog_walker'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'sitter' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_sitter', 'sitter_solo'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'photographer' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_photographer' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'pharmacy' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_pharmacy' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'ambulance' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_ambulance' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'resort' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_resort' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'breeder' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_breeder' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'sunset' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_sunset_services' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'adoption_center' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_shelter', 'pet_adoption_center'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'seller' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_products_store' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'relocation' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('pet_taxi', 'pet_transport', 'pet_relocation'));
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'nutritionist' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_nutritionist' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'insurance' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_insurance' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'event_organizer' AND is_active = true LIMIT 1) WHERE voa.role_id = (SELECT id FROM roles WHERE name = 'pet_event_organizer' LIMIT 1);
    UPDATE vendor_onboarding_applications voa SET role_id = (SELECT id FROM roles WHERE name = 'diagnostics_center' AND is_active = true LIMIT 1) WHERE voa.role_id IN (SELECT id FROM roles WHERE name IN ('diagnostics_solo', 'diagnostics_provider'));
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CATCH-ALL – VENDORS STILL ON INACTIVE ROLES (map by category/service)
-- ============================================================================
-- Any vendor whose role is inactive but not in the above list: map to closest canonical.
-- Default to solo when ambiguous (vet_solo, groomer_solo, trainer_solo).

DO $$
DECLARE
  rec RECORD;
  canonical_id UUID;
  canonical_name TEXT;
BEGIN
  FOR rec IN
    SELECT r.id AS role_id, r.name AS role_name, LOWER(COALESCE(r.name, '')) AS rlower
    FROM roles r
    WHERE r.is_active = false
      AND EXISTS (SELECT 1 FROM vendors v WHERE v.role_id = r.id)
  LOOP
    -- Infer canonical from role name (default solo)
    canonical_name := CASE
      WHEN rec.rlower LIKE '%vet%' OR rec.rlower LIKE '%clinic%' THEN 'vet_solo'
      WHEN rec.rlower LIKE '%groom%' OR rec.rlower LIKE '%spa%' THEN 'groomer_solo'
      WHEN rec.rlower LIKE '%train%' OR rec.rlower LIKE '%behavior%' THEN 'trainer_solo'
      WHEN rec.rlower LIKE '%walk%' THEN 'walker'
      WHEN rec.rlower LIKE '%sit%' THEN 'sitter'
      WHEN rec.rlower LIKE '%board%' OR rec.rlower LIKE '%daycare%' THEN 'boarding'
      WHEN rec.rlower LIKE '%cafe%' THEN 'cafe'
      WHEN rec.rlower LIKE '%photo%' THEN 'photographer'
      WHEN rec.rlower LIKE '%pharma%' THEN 'pharmacy'
      WHEN rec.rlower LIKE '%ambulance%' THEN 'ambulance'
      WHEN rec.rlower LIKE '%resort%' THEN 'resort'
      WHEN rec.rlower LIKE '%breed%' THEN 'breeder'
      WHEN rec.rlower LIKE '%sunset%' THEN 'sunset'
      WHEN rec.rlower LIKE '%adopt%' OR rec.rlower LIKE '%shelter%' THEN 'adoption_center'
      WHEN rec.rlower LIKE '%seller%' OR rec.rlower LIKE '%store%' OR rec.rlower LIKE '%shop%' THEN 'seller'
      WHEN rec.rlower LIKE '%relocat%' OR rec.rlower LIKE '%taxi%' OR rec.rlower LIKE '%transport%' THEN 'relocation'
      WHEN rec.rlower LIKE '%nutrition%' THEN 'nutritionist'
      WHEN rec.rlower LIKE '%insurance%' THEN 'insurance'
      WHEN rec.rlower LIKE '%event%' THEN 'event_organizer'
      WHEN rec.rlower LIKE '%diagnostic%' THEN 'diagnostics_center'
      ELSE 'vet_solo'
    END;
    SELECT id INTO canonical_id FROM roles WHERE name = canonical_name AND is_active = true LIMIT 1;
    IF canonical_id IS NOT NULL THEN
      UPDATE vendors SET role_id = canonical_id, updated_at = NOW() WHERE role_id = rec.role_id;
      RAISE NOTICE 'Mapped legacy role % to %', rec.role_name, canonical_name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  vendors_on_inactive INTEGER;
  total_vendors INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_vendors FROM vendors;
  SELECT COUNT(*) INTO vendors_on_inactive
  FROM vendors v
  JOIN roles r ON v.role_id = r.id
  WHERE r.is_active = false;

  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'LEGACY ROLE CONSOLIDATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total vendors: %', total_vendors;
  RAISE NOTICE 'Vendors still on inactive roles: % (should be 0)', vendors_on_inactive;
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

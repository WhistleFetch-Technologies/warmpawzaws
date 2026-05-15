-- ============================================================================
-- MIGRATION 613: Seed Veterinary Clinic onboarding form (prod parity)
-- Date: 2026-04-01
-- Purpose: Ensure onboarding_forms has clinic operational fields matching
--          db/migrations/050_complete_role_form_schemas.sql (vet_clinic block).
--          KYC fields are merged at read time; this row is the base clinic form.
--          Admin Catalog → Onboarding uses role name vet_clinic (canonical in prod).
-- ============================================================================

DO $$
DECLARE
  v_fields JSONB := '[
    {"id":"businessName","fieldName":"businessName","label":"Business Name","type":"text","section":"basic","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"min":2,"max":100},"displayOrder":1,"isActive":true},
    {"id":"ownerName","fieldName":"ownerName","label":"Owner Name","type":"text","section":"basic","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":2,"isActive":true},
    {"id":"phone","fieldName":"phone","label":"Phone Number","type":"tel","section":"basic","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"pattern":"^[0-9]{10}$"},"displayOrder":3,"isActive":true},
    {"id":"email","fieldName":"email","label":"Email Address","type":"email","section":"basic","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":4,"isActive":true},
    {"id":"clinicLicense","fieldName":"clinicLicense","label":"Clinic License Number","type":"text","section":"professional","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":5,"isActive":true},
    {"id":"numberOfVets","fieldName":"numberOfVets","label":"Number of Veterinarians","type":"number","section":"professional","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"min":1},"displayOrder":6,"isActive":true},
    {"id":"facilities","fieldName":"facilities","label":"Facilities Available","type":"multiselect","section":"professional","isMandatory":false,"required":false,"placeholder":"","helpText":"","options":["Surgery","X-Ray","Ultrasound","Laboratory","Pharmacy","Emergency"],"validation":{},"displayOrder":7,"isActive":true},
    {"id":"gstNumber","fieldName":"gstNumber","label":"GST Number","type":"text","section":"documents","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":8,"isActive":true},
    {"id":"clinicLicenseDoc","fieldName":"clinicLicenseDoc","label":"Clinic License Document","type":"file","section":"documents","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":9,"isActive":true},
    {"id":"address","fieldName":"address","label":"Business Address","type":"textarea","section":"location","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":10,"isActive":true},
    {"id":"location","fieldName":"location","label":"Location on Map","type":"map-pin","section":"location","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":11,"isActive":true},
    {"id":"serviceArea","fieldName":"serviceArea","label":"Service Area","type":"service-area","section":"location","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":12,"isActive":true},
    {"id":"bankAccount","fieldName":"bankAccount","label":"Bank Account Details","type":"bank-details","section":"banking","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":13,"isActive":true}
  ]'::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_forms')
     AND EXISTS (SELECT 1 FROM roles WHERE name = 'vet_clinic' AND is_active = true)
     AND NOT EXISTS (SELECT 1 FROM onboarding_forms WHERE role_id = 'vet_clinic') THEN
    INSERT INTO onboarding_forms (role_id, fields, status, version, created_at, updated_at)
    VALUES ('vet_clinic', v_fields, 'active', 1, NOW(), NOW());
    RAISE NOTICE '613: Seeded onboarding_forms for vet_clinic';
  ELSE
    RAISE NOTICE '613: Skipped vet_clinic seed (table/role missing or row already exists)';
  END IF;

  -- Legacy role name veterinary_clinic (if still active): mirror same form so admin URL / alias works
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_forms')
     AND EXISTS (SELECT 1 FROM roles WHERE name = 'veterinary_clinic' AND is_active = true)
     AND NOT EXISTS (SELECT 1 FROM onboarding_forms WHERE role_id = 'veterinary_clinic') THEN
    INSERT INTO onboarding_forms (role_id, fields, status, version, created_at, updated_at)
    VALUES ('veterinary_clinic', v_fields, 'active', 1, NOW(), NOW());
    RAISE NOTICE '613: Seeded onboarding_forms for veterinary_clinic';
  END IF;
END $$;

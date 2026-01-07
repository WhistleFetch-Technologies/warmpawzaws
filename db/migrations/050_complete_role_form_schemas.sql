-- ============================================================================
-- MIGRATION 050: COMPLETE FORM SCHEMAS FOR ALL 20 ROLES
-- ============================================================================
-- Date: 2026-01-XX
-- Purpose: Update all 20 roles with complete onboarding form schemas
-- Uses form schema generator logic to ensure consistency
-- ============================================================================

-- Helper function to update role config with form schema
CREATE OR REPLACE FUNCTION update_role_form_schema(
    p_role_name TEXT,
    p_schema JSONB
) RETURNS void AS $$
DECLARE
    v_role_id UUID;
    v_current_config JSONB;
BEGIN
    -- Get role ID and current config
    SELECT id, config INTO v_role_id, v_current_config
    FROM roles
    WHERE name = p_role_name;
    
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found', p_role_name;
    END IF;
    
    -- Update config with form schema
    UPDATE roles
    SET config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{onboardingFields}',
        p_schema,
        true
    ),
    updated_at = NOW()
    WHERE id = v_role_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HEALTHCARE ROLES (1-7)
-- ============================================================================

-- 1. Veterinarian
SELECT update_role_form_schema('veterinarian', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Professional Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic", "validation": {"min": 2, "max": 100}},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic", "validation": {"pattern": "^[0-9]{10}$"}},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "vetLicense", "label": "Veterinary License Number", "type": "text", "required": true, "section": "professional"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0, "max": 50}},
    {"id": "specializations", "label": "Specializations", "type": "multiselect", "required": false, "section": "professional", "options": ["Surgery", "Dermatology", "Cardiology", "Oncology", "Emergency", "General Practice"]},
    {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
    {"id": "vetLicenseDoc", "label": "Veterinary License Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 2. Vet Clinic
SELECT update_role_form_schema('vet_clinic', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Clinic Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "clinicLicense", "label": "Clinic License Number", "type": "text", "required": true, "section": "professional"},
    {"id": "numberOfVets", "label": "Number of Veterinarians", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "facilities", "label": "Facilities Available", "type": "multiselect", "required": false, "section": "professional", "options": ["Surgery", "X-Ray", "Ultrasound", "Laboratory", "Pharmacy", "Emergency"]},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "clinicLicenseDoc", "label": "Clinic License Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 3. Ambulance
SELECT update_role_form_schema('ambulance', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Vehicle Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "vehicleNumber", "label": "Vehicle Registration Number", "type": "text", "required": true, "section": "professional"},
    {"id": "vehicleType", "label": "Vehicle Type", "type": "select", "required": true, "section": "professional", "options": ["Ambulance Van", "Mobile Clinic", "SUV"]},
    {"id": "equipment", "label": "Equipment Available", "type": "multiselect", "required": false, "section": "professional", "options": ["Oxygen", "First Aid", "Stretcher", "Monitoring Equipment"]},
    {"id": "drivingLicense", "label": "Driving License", "type": "file", "required": true, "section": "documents"},
    {"id": "vehicleRegistration", "label": "Vehicle Registration Certificate", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 4. Diagnostics Center
SELECT update_role_form_schema('diagnostics_center', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Lab Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "labLicense", "label": "Laboratory License Number", "type": "text", "required": true, "section": "professional"},
    {"id": "testsOffered", "label": "Tests Offered", "type": "multiselect", "required": true, "section": "professional", "options": ["Blood Tests", "Urine Tests", "X-Ray", "Ultrasound", "MRI", "CT Scan", "Biopsy"]},
    {"id": "labLicenseDoc", "label": "Laboratory License Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 5. Pharmacy
SELECT update_role_form_schema('pharmacy', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Pharmacy Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "pharmacyLicense", "label": "Pharmacy License Number", "type": "text", "required": true, "section": "professional"},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "professional"},
    {"id": "pharmacyLicenseDoc", "label": "Pharmacy License Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 6. Pet Nutritionist
SELECT update_role_form_schema('pet_nutritionist', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Professional Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "certification", "label": "Nutrition Certification", "type": "text", "required": true, "section": "professional"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "certificationDoc", "label": "Certification Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 7. Pet Insurance
SELECT update_role_form_schema('pet_insurance', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Insurance Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "insuranceLicense", "label": "Insurance License Number", "type": "text", "required": true, "section": "professional"},
    {"id": "plansOffered", "label": "Insurance Plans Offered", "type": "multiselect", "required": false, "section": "professional", "options": ["Basic", "Premium", "Comprehensive", "Emergency Only"]},
    {"id": "insuranceLicenseDoc", "label": "Insurance License Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- ============================================================================
-- SERVICE PROVIDER ROLES (8-15)
-- ============================================================================

-- 8. Pet Groomer
SELECT update_role_form_schema('pet_groomer', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Professional Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "groomingCertification", "label": "Grooming Certification", "type": "text", "required": true, "section": "professional"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "servicesOffered", "label": "Services Offered", "type": "multiselect", "required": false, "section": "professional", "options": ["Bath", "Haircut", "Nail Trimming", "Ear Cleaning", "Teeth Cleaning", "Styling"]},
    {"id": "certificationDoc", "label": "Certification Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 9. Pet Trainer
SELECT update_role_form_schema('pet_trainer', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Training Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "trainingCertification", "label": "Training Certification", "type": "text", "required": true, "section": "professional"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "specializations", "label": "Training Specializations", "type": "multiselect", "required": false, "section": "professional", "options": ["Basic Obedience", "Advanced Training", "Behavior Modification", "Puppy Training", "Agility"]},
    {"id": "certificationDoc", "label": "Certification Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 10. Pet Walker
SELECT update_role_form_schema('pet_walker', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Walking Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "maxDogsPerWalk", "label": "Maximum Dogs Per Walk", "type": "number", "required": true, "section": "professional", "validation": {"min": 1, "max": 10}},
    {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 11. Pet Sitter
SELECT update_role_form_schema('pet_sitter', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Sitting Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "maxPets", "label": "Maximum Pets at Once", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 12. Pet Boarder
SELECT update_role_form_schema('pet_boarder', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Boarding Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "numberOfRooms", "label": "Number of Rooms", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "capacity", "label": "Total Capacity (Pets)", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "facilities", "label": "Facilities", "type": "multiselect", "required": false, "section": "professional", "options": ["AC Rooms", "Play Area", "Grooming", "Veterinary Care", "24/7 Monitoring"]},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "businessLicense", "label": "Business License", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 13. Pet Transport
SELECT update_role_form_schema('pet_transport', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Transport Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "vehicleNumber", "label": "Vehicle Registration Number", "type": "text", "required": true, "section": "professional"},
    {"id": "vehicleType", "label": "Vehicle Type", "type": "select", "required": true, "section": "professional", "options": ["Van", "SUV", "Sedan", "Truck"]},
    {"id": "drivingLicense", "label": "Driving License", "type": "file", "required": true, "section": "documents"},
    {"id": "vehicleRegistration", "label": "Vehicle Registration Certificate", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 14. Pet Photographer
SELECT update_role_form_schema('pet_photographer', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Photography Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "specializations", "label": "Photography Types", "type": "multiselect", "required": false, "section": "professional", "options": ["Portrait", "Event", "Outdoor", "Studio", "Action"]},
    {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 15. Pet Spa
SELECT update_role_form_schema('pet_spa', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Spa Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "numberOfRooms", "label": "Number of Treatment Rooms", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "servicesOffered", "label": "Spa Services", "type": "multiselect", "required": false, "section": "professional", "options": ["Massage", "Aromatherapy", "Mud Bath", "Hydrotherapy", "Grooming", "Nail Care"]},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "businessLicense", "label": "Business License", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- ============================================================================
-- HOSPITALITY & RETAIL ROLES (16-20)
-- ============================================================================

-- 16. Pet Cafe
SELECT update_role_form_schema('pet_cafe', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Cafe Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "numberOfTables", "label": "Number of Tables", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "seatingCapacity", "label": "Seating Capacity", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "fssaiLicense", "label": "FSSAI License", "type": "file", "required": true, "section": "documents"},
    {"id": "businessLicense", "label": "Business License", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 17. Pet Adoption Center
SELECT update_role_form_schema('pet_adoption_center', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Adoption Center Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "capacity", "label": "Maximum Capacity (Pets)", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "facilities", "label": "Facilities", "type": "multiselect", "required": false, "section": "professional", "options": ["Veterinary Care", "Quarantine Area", "Play Area", "Medical Records"]},
    {"id": "registrationNumber", "label": "Registration Number", "type": "text", "required": true, "section": "documents"},
    {"id": "registrationDoc", "label": "Registration Document", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 18. Pet Event Organizer
SELECT update_role_form_schema('pet_event_organizer', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Event Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "eventTypes", "label": "Event Types", "type": "multiselect", "required": false, "section": "professional", "options": ["Birthday Parties", "Pet Shows", "Training Workshops", "Social Gatherings", "Adoption Events"]},
    {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 19. Pet Relocation
SELECT update_role_form_schema('pet_relocation', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Relocation Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional", "validation": {"min": 0}},
    {"id": "serviceTypes", "label": "Service Types", "type": "multiselect", "required": false, "section": "professional", "options": ["Domestic", "International", "Documentation", "Quarantine Assistance"]},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "businessLicense", "label": "Business License", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- 20. Pet Daycare
SELECT update_role_form_schema('pet_daycare', '{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Daycare Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true, "section": "basic"},
    {"id": "email", "label": "Email Address", "type": "email", "required": true, "section": "basic"},
    {"id": "capacity", "label": "Maximum Capacity (Pets)", "type": "number", "required": true, "section": "professional", "validation": {"min": 1}},
    {"id": "facilities", "label": "Facilities", "type": "multiselect", "required": false, "section": "professional", "options": ["Play Area", "Rest Area", "Feeding Area", "Outdoor Space", "Supervision"]},
    {"id": "gstNumber", "label": "GST Number", "type": "text", "required": true, "section": "documents"},
    {"id": "businessLicense", "label": "Business License", "type": "file", "required": true, "section": "documents"},
    {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
    {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
    {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
    {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
  ]
}'::jsonb);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all roles have form schemas
DO $$
DECLARE
    v_role_count INTEGER;
    v_schema_count INTEGER;
    v_role_record RECORD;
BEGIN
    -- Count roles with form schemas
    SELECT COUNT(*) INTO v_schema_count
    FROM roles
    WHERE is_active = true
      AND config->'onboardingFields' IS NOT NULL
      AND config->'onboardingFields'->'fields' IS NOT NULL
      AND jsonb_array_length(config->'onboardingFields'->'fields') > 0;
    
    SELECT COUNT(*) INTO v_role_count
    FROM roles
    WHERE is_active = true;
    
    RAISE NOTICE '✅ Total active roles: %', v_role_count;
    RAISE NOTICE '✅ Roles with form schemas: %', v_schema_count;
    
    IF v_schema_count < v_role_count THEN
        RAISE WARNING 'Some roles are missing form schemas';
        
        -- List roles without schemas
        FOR v_role_record IN
            SELECT name, display_name
            FROM roles
            WHERE is_active = true
              AND (config->'onboardingFields' IS NULL 
                   OR config->'onboardingFields'->'fields' IS NULL
                   OR jsonb_array_length(config->'onboardingFields'->'fields') = 0)
        LOOP
            RAISE NOTICE '   ⚠️  Missing schema: % (%)', v_role_record.display_name, v_role_record.name;
        END LOOP;
    ELSE
        RAISE NOTICE '✅ All roles have complete form schemas!';
    END IF;
END $$;

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Drop helper function (optional, can keep for future use)
-- DROP FUNCTION IF EXISTS update_role_form_schema(TEXT, JSONB);


-- ============================================================================
-- SEED ONBOARDING ROLE CONFIGURATIONS
-- ============================================================================
-- Migration: 050 - Seed Role Configurations for Onboarding
-- Date: 2025-01-06
-- 
-- Updates existing roles with onboardingFormSchema in config JSONB
-- ============================================================================

-- Update Pet Groomer role
UPDATE roles
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{onboardingFormSchema}',
    '{
      "solo": {
        "version": "1.0",
        "fields": [
          {
            "name": "businessName",
            "label": "Business Name",
            "type": "text",
            "required": true,
            "validation": {"minLength": 3, "maxLength": 100}
          },
          {
            "name": "ownerName",
            "label": "Your Name",
            "type": "text",
            "required": true
          },
          {
            "name": "email",
            "label": "Email Address",
            "type": "email",
            "required": true
          },
          {
            "name": "alternatePhone",
            "label": "Alternate Phone",
            "type": "tel",
            "required": false
          },
          {
            "name": "address",
            "label": "Business Address",
            "type": "text",
            "required": true
          },
          {
            "name": "city",
            "label": "City",
            "type": "text",
            "required": true
          },
          {
            "name": "state",
            "label": "State",
            "type": "select",
            "required": true,
            "options": ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Gujarat"]
          },
          {
            "name": "pincode",
            "label": "Pincode",
            "type": "text",
            "required": true,
            "validation": {"pattern": "^[0-9]{6}$"}
          },
          {
            "name": "experienceYears",
            "label": "Years of Experience",
            "type": "number",
            "required": true,
            "validation": {"min": 0, "max": 50}
          },
          {
            "name": "specialization",
            "label": "Specialization",
            "type": "multiselect",
            "required": false,
            "options": ["Small Dogs", "Large Dogs", "Cats", "Exotic Pets"]
          },
          {
            "name": "idProof",
            "label": "ID Proof (Aadhaar/PAN)",
            "type": "file",
            "required": true,
            "accept": ["pdf", "jpg", "png"],
            "maxSize": 5242880
          }
        ]
      },
      "business": {
        "version": "1.0",
        "fields": [
          {
            "name": "businessName",
            "label": "Business Name",
            "type": "text",
            "required": true
          },
          {
            "name": "ownerName",
            "label": "Owner/Authorized Person Name",
            "type": "text",
            "required": true
          },
          {
            "name": "email",
            "label": "Business Email",
            "type": "email",
            "required": true
          },
          {
            "name": "registrationNumber",
            "label": "Business Registration Number",
            "type": "text",
            "required": true
          },
          {
            "name": "gstNumber",
            "label": "GST Number",
            "type": "text",
            "required": true,
            "validation": {"pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"}
          },
          {
            "name": "panNumber",
            "label": "PAN Number",
            "type": "text",
            "required": true,
            "validation": {"pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"}
          },
          {
            "name": "address",
            "label": "Registered Business Address",
            "type": "text",
            "required": true
          },
          {
            "name": "city",
            "label": "City",
            "type": "text",
            "required": true
          },
          {
            "name": "state",
            "label": "State",
            "type": "select",
            "required": true,
            "options": ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Gujarat"]
          },
          {
            "name": "pincode",
            "label": "Pincode",
            "type": "text",
            "required": true
          },
          {
            "name": "registrationCertificate",
            "label": "Registration Certificate",
            "type": "file",
            "required": true,
            "accept": ["pdf"],
            "maxSize": 10485760
          },
          {
            "name": "gstCertificate",
            "label": "GST Certificate",
            "type": "file",
            "required": true,
            "accept": ["pdf"],
            "maxSize": 10485760
          },
          {
            "name": "panCard",
            "label": "PAN Card",
            "type": "file",
            "required": true,
            "accept": ["pdf", "jpg", "png"],
            "maxSize": 5242880
          }
        ]
      }
    }'::jsonb
)
WHERE name = 'groomer' OR name = 'pet_groomer';

-- Update Veterinary Clinic role (business only)
UPDATE roles
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{onboardingFormSchema}',
    '{
      "business": {
        "version": "1.0",
        "fields": [
          {
            "name": "clinicName",
            "label": "Clinic Name",
            "type": "text",
            "required": true
          },
          {
            "name": "licenseNumber",
            "label": "Veterinary License Number",
            "type": "text",
            "required": true
          },
          {
            "name": "licenseCertificate",
            "label": "License Certificate",
            "type": "file",
            "required": true,
            "accept": ["pdf"],
            "maxSize": 10485760
          },
          {
            "name": "numberOfVets",
            "label": "Number of Veterinarians",
            "type": "number",
            "required": true,
            "validation": {"min": 1}
          },
          {
            "name": "facilities",
            "label": "Available Facilities",
            "type": "multiselect",
            "required": true,
            "options": ["X-Ray", "Ultrasound", "Surgery Room", "ICU", "Pharmacy"]
          },
          {
            "name": "address",
            "label": "Clinic Address",
            "type": "text",
            "required": true
          },
          {
            "name": "city",
            "label": "City",
            "type": "text",
            "required": true
          },
          {
            "name": "state",
            "label": "State",
            "type": "select",
            "required": true,
            "options": ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Gujarat"]
          },
          {
            "name": "pincode",
            "label": "Pincode",
            "type": "text",
            "required": true
          }
        ]
      }
    }'::jsonb
)
WHERE name = 'veterinarian' OR name = 'vet_clinic';

-- Update vendorTypes in config for all roles
UPDATE roles
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{vendorTypes}',
    CASE 
        WHEN name IN ('groomer', 'pet_groomer') THEN '["solo", "business"]'::jsonb
        WHEN name IN ('veterinarian', 'vet_clinic') THEN '["business"]'::jsonb
        ELSE '["solo", "business"]'::jsonb
    END
)
WHERE config IS NULL OR config->'vendorTypes' IS NULL;

COMMENT ON TABLE roles IS 'Roles table with onboardingFormSchema in config JSONB for dynamic form generation';


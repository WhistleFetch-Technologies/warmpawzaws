-- ============================================================================
-- MIGRATION 047: SEED 20 WARMPAWZ ROLES
-- ============================================================================
-- Date: 2026-01-03
-- Purpose: Seed all 20 vendor roles for the Warmpawz platform
-- ============================================================================

-- Insert roles with proper configuration
-- Using ON CONFLICT DO NOTHING for idempotency

INSERT INTO roles (name, display_name, description, is_system_role, is_active, config) VALUES

-- Healthcare Roles (1-7)
('veterinarian', 'Veterinarian', 'Licensed veterinary professional providing medical care for pets', false, true, '{
  "category": "healthcare",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_center", "at_home", "tele"],
  "capabilities": ["medical_records", "prescription_create", "diagnostic_results", "booking_create", "booking_view", "service_pricing"],
  "onboardingFields": {
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
      {"id": "vetLicense", "label": "Veterinary License Number", "type": "text", "required": true, "section": "professional"},
      {"id": "experience", "label": "Years of Experience", "type": "number", "required": true, "section": "professional"},
      {"id": "specializations", "label": "Specializations", "type": "multiselect", "required": false, "section": "professional"},
      {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
      {"id": "vetLicenseDoc", "label": "Veterinary License Document", "type": "file", "required": true, "section": "documents"},
      {"id": "address", "label": "Business Address", "type": "textarea", "required": true, "section": "location"},
      {"id": "location", "label": "Location on Map", "type": "map-pin", "required": true, "section": "location"},
      {"id": "serviceArea", "label": "Service Area", "type": "service-area", "required": true, "section": "location"},
      {"id": "bankAccount", "label": "Bank Account Details", "type": "bank-details", "required": true, "section": "banking"}
    ]
  }
}'),

('vet_clinic', 'Veterinary Clinic', 'Full-service veterinary clinic with multiple staff and facilities', false, true, '{
  "category": "healthcare",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["medical_records", "prescription_create", "diagnostic_results", "staff_create", "staff_schedule", "booking_create", "service_pricing", "inventory_manage"],
  "onboardingFields": {"version": 1, "sections": [{"id": "basic", "name": "Basic Information", "order": 1}], "fields": []}
}'),

('ambulance', 'Pet Ambulance Service', 'Emergency pet transportation and ambulance services', false, true, '{
  "category": "healthcare",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_home"],
  "capabilities": ["gps_tracking", "booking_create", "booking_view", "service_pricing"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('diagnostics_center', 'Diagnostics Center', 'Pet diagnostic laboratory and imaging center', false, true, '{
  "category": "healthcare",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center", "at_home"],
  "capabilities": ["diagnostic_results", "booking_create", "service_pricing", "staff_create"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pharmacy', 'Pet Pharmacy', 'Pet medication and pharmacy services', false, true, '{
  "category": "retail",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["inventory_manage", "product_catalog", "orders", "order_dispatch", "order_broadcast", "availability_check", "prescription_create", "prescription_verification", "delivery", "expiry_management", "controlled_substances"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_nutritionist', 'Pet Nutritionist', 'Pet nutrition consultation and diet planning services', false, true, '{
  "category": "healthcare",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_center", "at_home", "tele"],
  "capabilities": ["booking_create", "service_pricing", "medical_records"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_insurance', 'Pet Insurance Provider', 'Pet insurance and coverage services', false, true, '{
  "category": "specialist",
  "vendorTypes": ["center"],
  "serviceStyles": ["tele"],
  "capabilities": ["booking_create", "service_pricing"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

-- Service Provider Roles (8-15)
('pet_groomer', 'Pet Groomer', 'Professional pet grooming and styling services', false, true, '{
  "category": "service_provider",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_center", "at_home"],
  "capabilities": ["booking_create", "booking_view", "service_pricing", "staff_schedule"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_trainer', 'Pet Trainer', 'Pet training and behavior modification services', false, true, '{
  "category": "service_provider",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_center", "at_home"],
  "capabilities": ["booking_create", "service_pricing", "staff_create"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_walker', 'Pet Walker', 'Professional dog walking and exercise services', false, true, '{
  "category": "service_provider",
  "vendorTypes": ["solo_provider"],
  "serviceStyles": ["at_home"],
  "capabilities": ["gps_tracking", "booking_create", "booking_view"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_sitter', 'Pet Sitter', 'Pet sitting and home care services', false, true, '{
  "category": "service_provider",
  "vendorTypes": ["solo_provider"],
  "serviceStyles": ["at_home"],
  "capabilities": ["booking_create", "booking_view", "service_pricing"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_boarder', 'Pet Boarding', 'Pet boarding and hotel services', false, true, '{
  "category": "hospitality",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["booking_create", "service_pricing", "staff_create", "inventory_manage"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_transport', 'Pet Transport', 'Pet relocation and transportation services', false, true, '{
  "category": "service_provider",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_home"],
  "capabilities": ["gps_tracking", "booking_create", "booking_view"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_photographer', 'Pet Photographer', 'Professional pet photography services', false, true, '{
  "category": "specialist",
  "vendorTypes": ["solo_provider"],
  "serviceStyles": ["at_center", "at_home"],
  "capabilities": ["booking_create", "service_pricing"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_spa', 'Pet Spa', 'Luxury pet spa and wellness center', false, true, '{
  "category": "hospitality",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["booking_create", "service_pricing", "staff_create", "staff_schedule"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

-- Hospitality & Retail Roles (16-20)
('pet_cafe', 'Pet Cafe', 'Pet-friendly cafe and dining services', false, true, '{
  "category": "hospitality",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["booking_create", "inventory_manage", "product_catalog", "staff_create"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_adoption_center', 'Pet Adoption Center', 'Pet adoption and rescue center services', false, true, '{
  "category": "specialist",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["booking_create", "medical_records", "staff_create"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_event_organizer', 'Pet Event Organizer', 'Pet events, parties, and social gatherings', false, true, '{
  "category": "specialist",
  "vendorTypes": ["solo_provider", "center"],
  "serviceStyles": ["at_center", "at_home"],
  "capabilities": ["booking_create", "service_pricing"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_relocation', 'Pet Relocation Services', 'International and domestic pet relocation services', false, true, '{
  "category": "specialist",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_home"],
  "capabilities": ["booking_create", "service_pricing", "gps_tracking"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}'),

('pet_daycare', 'Pet Daycare', 'Daytime pet care and socialization services', false, true, '{
  "category": "hospitality",
  "vendorTypes": ["center"],
  "serviceStyles": ["at_center"],
  "capabilities": ["booking_create", "service_pricing", "staff_create", "staff_schedule"],
  "onboardingFields": {"version": 1, "sections": [], "fields": []}
}')

ON CONFLICT (name) DO NOTHING;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully seeded 20 Warmpawz roles';
END $$;


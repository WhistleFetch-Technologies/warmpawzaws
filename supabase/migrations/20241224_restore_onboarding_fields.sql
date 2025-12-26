-- Migration: Restore Missing Onboarding Fields
-- Date: 2024-12-24
-- Purpose: Add Aadhar Number, Google Maps PIN Location, and Specialization fields to all roles

DO $$
DECLARE
  role_record RECORD;
  existing_fields JSONB;
  updated_fields JSONB;
  max_order INTEGER;
  max_address_order INTEGER;
  has_aadhar BOOLEAN;
  has_location_pin BOOLEAN;
  has_specialization BOOLEAN;
  medical_roles TEXT[] := ARRAY['veterinarian', 'vet_clinic', 'nutritionist', 'behaviourist'];
  specialization_options JSONB;
BEGIN
  FOR role_record IN SELECT name, config FROM roles WHERE is_active = true LOOP
    existing_fields := COALESCE(role_record.config->'onboardingFields'->'fields', '[]'::jsonb);
    updated_fields := existing_fields;
    
    -- Check for Aadhar field
    has_aadhar := EXISTS (
      SELECT 1 FROM jsonb_array_elements(existing_fields) AS field
      WHERE (field->>'fieldName' = 'aadharNumber' OR field->>'name' = 'aadharNumber' OR field->>'id' LIKE '%aadhar%')
    );
    
    -- Check for Google Maps PIN location field
    has_location_pin := EXISTS (
      SELECT 1 FROM jsonb_array_elements(existing_fields) AS field
      WHERE (
        field->>'fieldName' = 'businessLocation' OR 
        field->>'name' = 'businessLocation' OR
        field->>'fieldName' = 'location' OR
        field->>'name' = 'location' OR
        field->>'type' = 'map_pin' OR
        field->>'type' = 'coordinates'
      )
    );
    
    -- Check for Specialization field (for medical roles)
    has_specialization := EXISTS (
      SELECT 1 FROM jsonb_array_elements(existing_fields) AS field
      WHERE (
        field->>'fieldName' = 'specialization' OR 
        field->>'name' = 'specialization' OR
        field->>'fieldName' = 'specializations' OR
        field->>'name' = 'specializations' OR
        LOWER(COALESCE(field->>'label', '')) LIKE '%specialization%'
      )
    );
    
    -- Add Aadhar Number field if missing
    IF NOT has_aadhar THEN
      -- Find max order
      SELECT COALESCE(MAX((field->>'displayOrder')::INTEGER), MAX((field->>'order')::INTEGER), 0)
      INTO max_order
      FROM jsonb_array_elements(existing_fields) AS field;
      
      updated_fields := updated_fields || jsonb_build_array(
        jsonb_build_object(
          'id', 'field_aadharNumber_' || extract(epoch from now())::bigint,
          'fieldName', 'aadharNumber',
          'name', 'aadharNumber',
          'label', 'Aadhar Number',
          'type', 'text',
          'section', 'identity_info',
          'isMandatory', true,
          'requiresDocument', true,
          'documentLabel', 'Aadhar Card',
          'placeholder', '1234 5678 9012',
          'helpText', 'Enter your 12-digit Aadhar number for identity verification',
          'validation', jsonb_build_object(
            'required', true,
            'pattern', '^[0-9]{12}$',
            'message', 'Aadhar must be 12 digits'
          ),
          'displayOrder', max_order + 1,
          'order', max_order + 1,
          'isActive', true,
          'createdAt', to_jsonb(now()::text),
          'updatedAt', to_jsonb(now()::text),
          'acceptedFileTypes', jsonb_build_array('image/jpeg', 'image/png', 'application/pdf')
        )
      );
      
      RAISE NOTICE 'Added Aadhar field to role: %', role_record.name;
    END IF;
    
    -- Add Google Maps PIN location field if missing
    IF NOT has_location_pin THEN
      -- Find max order in address_location section
      SELECT COALESCE(MAX((field->>'displayOrder')::INTEGER), MAX((field->>'order')::INTEGER), 0)
      INTO max_address_order
      FROM jsonb_array_elements(existing_fields) AS field
      WHERE field->>'section' IN ('address_location', 'location_information');
      
      -- If no address fields, use max order from all fields
      IF max_address_order = 0 THEN
        SELECT COALESCE(MAX((field->>'displayOrder')::INTEGER), MAX((field->>'order')::INTEGER), 0)
        INTO max_address_order
        FROM jsonb_array_elements(existing_fields) AS field;
      END IF;
      
      updated_fields := updated_fields || jsonb_build_array(
        jsonb_build_object(
          'id', 'field_businessLocation_' || extract(epoch from now())::bigint,
          'fieldName', 'businessLocation',
          'name', 'businessLocation',
          'label', 'Business Location (Pin on Map)',
          'type', 'map_pin',
          'section', 'address_location',
          'isMandatory', true,
          'requiresDocument', false,
          'placeholder', 'Click to pin your business location on the map',
          'helpText', 'Use Google Maps to pin your exact business location. This helps customers find you easily.',
          'validation', jsonb_build_object('required', true),
          'displayOrder', max_address_order + 1,
          'order', max_address_order + 1,
          'isActive', true,
          'createdAt', to_jsonb(now()::text),
          'updatedAt', to_jsonb(now()::text),
          'metadata', jsonb_build_object(
            'googleMapsEnabled', true,
            'allowsDrag', true,
            'showPreview', true
          )
        )
      );
      
      RAISE NOTICE 'Added Google Maps PIN field to role: %', role_record.name;
    END IF;
    
    -- Add Specialization field for medical roles if missing
    IF (role_record.name = ANY(medical_roles) OR role_record.name LIKE '%vet%' OR role_record.name LIKE '%doctor%' OR role_record.name LIKE '%clinic%') AND NOT has_specialization THEN
      -- Get role-specific specialization options
      IF role_record.name IN ('veterinarian', 'vet_clinic') THEN
        specialization_options := jsonb_build_array(
          'General Practice', 'Surgery', 'Dental', 'Ophthalmology', 
          'Dermatology', 'Cardiology', 'Orthopedics', 'Emergency Care', 'Internal Medicine'
        );
      ELSIF role_record.name = 'nutritionist' THEN
        specialization_options := jsonb_build_array(
          'Weight Management', 'Disease-Specific Nutrition', 'Puppy/Kitten Nutrition', 
          'Senior Pet Nutrition', 'Allergies'
        );
      ELSIF role_record.name = 'behaviourist' THEN
        specialization_options := jsonb_build_array(
          'Aggression', 'Anxiety', 'Separation Anxiety', 'House Training', 'Basic Obedience'
        );
      ELSE
        specialization_options := jsonb_build_array('General', 'Specialized');
      END IF;
      
      -- Find max order
      SELECT COALESCE(MAX((field->>'displayOrder')::INTEGER), MAX((field->>'order')::INTEGER), 0)
      INTO max_order
      FROM jsonb_array_elements(existing_fields) AS field;
      
      updated_fields := updated_fields || jsonb_build_array(
        jsonb_build_object(
          'id', 'field_specialization_' || extract(epoch from now())::bigint,
          'fieldName', 'specialization',
          'name', 'specialization',
          'label', 'Specialization',
          'type', 'multi_select',
          'section', 'business_information',
          'isMandatory', false,
          'requiresDocument', false,
          'placeholder', 'Select your specializations',
          'helpText', 'Select all areas you specialize in (you can choose multiple)',
          'options', specialization_options,
          'validation', jsonb_build_object('required', false),
          'displayOrder', max_order + 1,
          'order', max_order + 1,
          'isActive', true,
          'createdAt', to_jsonb(now()::text),
          'updatedAt', to_jsonb(now()::text)
        )
      );
      
      RAISE NOTICE 'Added Specialization field to role: %', role_record.name;
    END IF;
    
    -- Update role config if fields were added
    IF updated_fields != existing_fields THEN
      UPDATE roles
      SET config = jsonb_set(
        jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{onboardingFields,fields}',
          updated_fields
        ),
        '{onboardingFields,version}',
        to_jsonb(COALESCE((config->'onboardingFields'->>'version')::INTEGER, 0) + 1)
      ),
      updated_at = now()
      WHERE name = role_record.name;
      
      RAISE NOTICE 'Updated role: %', role_record.name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed successfully!';
END $$;


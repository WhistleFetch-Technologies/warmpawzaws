-- ============================================================================
-- MIGRATION 144: MAP ROLE CAPABILITIES
-- ============================================================================
-- Date: 2026-01-17
-- Purpose: Map correct capabilities to each role based on service type,
--          vendor configuration (solo/business), and service styles
-- ============================================================================
-- This migration assigns appropriate capabilities to each role based on:
-- 1. Service type (vet needs medical_records, prescriptions, etc.)
-- 2. Vendor configuration (solo vs business)
-- 3. Service styles (at_center, at_home, tele, delivery, etc.)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Define Base Capabilities by Service Type
-- ============================================================================

-- Common capabilities for all roles
DO $$
DECLARE
  base_capabilities TEXT[] := ARRAY[
    'dashboard', 'profile', 'chat', 'notifications', 
    'bookings', 'earnings', 'settlements', 'bank_account',
    'bank_verification', 'location_verification', 'address_verification', 'kyc_verification'
  ];
  
  -- Service-specific capabilities
  vet_capabilities TEXT[] := ARRAY[
    'prescriptions', 'medical_records', 'diagnostics', 'emergency',
    'patient_monitoring', 'vet_summary', 'prescription_verification'
  ];
  
  shop_capabilities TEXT[] := ARRAY[
    'catalog', 'inventory', 'orders', 'delivery', 
    'pricing', 'promotions', 'coupons', 'analytics'
  ];
  
  pharmacy_capabilities TEXT[] := ARRAY[
    'catalog', 'inventory', 'orders', 'delivery', 'prescriptions',
    'prescription_verification', 'controlled_substances', 'expiry_management',
    'order_dispatch', 'order_broadcast', 'availability_check', 
    'radius_service', 'invoice_generation', 'cod_payment', 'online_payment',
    'delivery_partner', 'eta_tracking'
  ];
  
  grooming_capabilities TEXT[] := ARRAY[
    'gallery', 'portfolio', 'custom_services', 'package_management', 'pricing'
  ];
  
  training_capabilities TEXT[] := ARRAY[
    'training_programs', 'progress_tracking', 'custom_services', 
    'package_management', 'pricing'
  ];
  
  boarding_capabilities TEXT[] := ARRAY[
    'rooms', 'room_management', 'cctv_access', 'occupancy_tracking', 'nightly_pricing'
  ];
  
  cafe_capabilities TEXT[] := ARRAY[
    'cafe_tables', 'table_management', 'menu', 'pax_management', 'events'
  ];
  
  ambulance_capabilities TEXT[] := ARRAY[
    'gps_tracking', 'live_location', 'emergency', 'emergency_protocols', 'ambulance_services'
  ];
  
  insurance_capabilities TEXT[] := ARRAY[
    'insurance_plans', 'policy_management', 'claims_management'
  ];
  
  nutritionist_capabilities TEXT[] := ARRAY[
    'meal_plans', 'diet_charts', 'progress_tracking'
  ];
  
  adoption_capabilities TEXT[] := ARRAY[
    'adoption', 'pet_profiles', 'donation', 'events'
  ];
  
  breeder_capabilities TEXT[] := ARRAY[
    'pet_profiles', 'catalog', 'custom_services'
  ];
  
  relocation_capabilities TEXT[] := ARRAY[
    'gps_tracking', 'distance_pricing', 'live_location'
  ];
  
  resort_capabilities TEXT[] := ARRAY[
    'rooms', 'room_management', 'cctv_access', 'occupancy_tracking', 'nightly_pricing', 'events'
  ];
  
  holiday_capabilities TEXT[] := ARRAY[
    'rooms', 'room_management', 'cctv_access', 'occupancy_tracking', 'nightly_pricing', 'events'
  ];
  
  sunset_capabilities TEXT[] := ARRAY[
    'memorial', 'counseling', 'custom_services'
  ];
  
  walker_capabilities TEXT[] := ARRAY[
    'walking', 'gps_tracking', 'live_location', 'photo_updates'
  ];
  
  sitter_capabilities TEXT[] := ARRAY[
    'photo_updates', 'gps_tracking', 'live_location'
  ];
  
  photography_capabilities TEXT[] := ARRAY[
    'gallery', 'portfolio', 'progress_tracking'
  ];
  
  -- Business-only capabilities (not for solo)
  business_only_capabilities TEXT[] := ARRAY[
    'staff_management', 'staff_create', 'staff_schedule', 
    'inventory_manage', 'inventory',
    'facility_management', 'center_profile'
  ];
  
  -- Service style capabilities
  at_center_capabilities TEXT[] := ARRAY[
    'facility_management', 'cctv_access'
  ];
  
  at_home_capabilities TEXT[] := ARRAY[
    'gps_tracking', 'live_location', 'distance_pricing'
  ];
  
  tele_capabilities TEXT[] := ARRAY[
    'tele', 'video_calling'
  ];
  
  delivery_capabilities TEXT[] := ARRAY[
    'delivery', 'delivery_partner', 'eta_tracking'
  ];
  
  current_role_id UUID;
  role_name TEXT;
  role_service TEXT;
  role_config JSONB;
  vendor_config TEXT;
  service_styles TEXT[];
  final_capabilities TEXT[];
  cap TEXT;
BEGIN
  -- Loop through all active roles
  FOR current_role_id, role_name, role_service, role_config IN
    SELECT id, name, customer_service, config FROM roles WHERE is_active = true
  LOOP
    -- Initialize capabilities with base set
    final_capabilities := base_capabilities;
    
    -- Get vendor configuration and service styles
    vendor_config := role_config->>'vendorConfiguration';
    service_styles := ARRAY(
      SELECT jsonb_array_elements_text(
        CASE 
          WHEN role_config->'serviceStyles'->'selected' IS NOT NULL 
          THEN role_config->'serviceStyles'->'selected'
          WHEN role_config->'serviceStyles' IS NOT NULL AND jsonb_typeof(role_config->'serviceStyles') = 'array'
          THEN role_config->'serviceStyles'
          ELSE '[]'::jsonb
        END
      )
    );
    
    -- Add service-specific capabilities based on customer_service
    CASE role_service
      WHEN 'vet' THEN
        final_capabilities := final_capabilities || vet_capabilities;
      WHEN 'shop' THEN
        IF role_name = 'pharmacy' THEN
          final_capabilities := final_capabilities || pharmacy_capabilities;
        ELSE
          final_capabilities := final_capabilities || shop_capabilities;
        END IF;
      WHEN 'grooming' THEN
        final_capabilities := final_capabilities || grooming_capabilities;
      WHEN 'training' THEN
        final_capabilities := final_capabilities || training_capabilities;
      WHEN 'boarding' THEN
        final_capabilities := final_capabilities || boarding_capabilities;
      WHEN 'cafes' THEN
        final_capabilities := final_capabilities || cafe_capabilities;
      WHEN 'ambulance' THEN
        final_capabilities := final_capabilities || ambulance_capabilities;
      WHEN 'insurance' THEN
        final_capabilities := final_capabilities || insurance_capabilities;
      WHEN 'nutritionist' THEN
        final_capabilities := final_capabilities || nutritionist_capabilities;
      WHEN 'adoption' THEN
        final_capabilities := final_capabilities || adoption_capabilities;
      WHEN 'breeder' THEN
        final_capabilities := final_capabilities || breeder_capabilities;
      WHEN 'relocation' THEN
        final_capabilities := final_capabilities || relocation_capabilities;
      WHEN 'resort' THEN
        final_capabilities := final_capabilities || resort_capabilities;
      WHEN 'holiday' THEN
        final_capabilities := final_capabilities || holiday_capabilities;
      WHEN 'sunset' THEN
        final_capabilities := final_capabilities || sunset_capabilities;
      WHEN 'walker' THEN
        final_capabilities := final_capabilities || walker_capabilities;
      WHEN 'sitter' THEN
        final_capabilities := final_capabilities || sitter_capabilities;
      WHEN 'photography' THEN
        final_capabilities := final_capabilities || photography_capabilities;
      ELSE
        -- For roles without customer_service (diagnostics_center, event_organizer)
        IF role_name = 'diagnostics_center' THEN
          final_capabilities := final_capabilities || ARRAY['diagnostics', 'diagnostic_lab', 'diagnostic_results'];
        ELSIF role_name = 'event_organizer' THEN
          final_capabilities := final_capabilities || ARRAY['events', 'pax_management'];
        END IF;
    END CASE;
    
    -- Add business-only capabilities if vendor_config is 'business'
    IF vendor_config = 'business' THEN
      final_capabilities := final_capabilities || business_only_capabilities;
    ELSE
      -- For solo, add solo-specific capabilities
      final_capabilities := final_capabilities || ARRAY['professional_profile', 'platform_catalog_services'];
    END IF;
    
    -- Add service style capabilities
    IF 'at_center' = ANY(service_styles) OR 'at_clinic' = ANY(service_styles) THEN
      final_capabilities := final_capabilities || at_center_capabilities;
    END IF;
    
    IF 'at_home' = ANY(service_styles) OR 'home_visit' = ANY(service_styles) THEN
      final_capabilities := final_capabilities || at_home_capabilities;
    END IF;
    
    IF 'tele' = ANY(service_styles) OR 'video_consultation' = ANY(service_styles) OR 'online' = ANY(service_styles) THEN
      final_capabilities := final_capabilities || tele_capabilities;
    END IF;
    
    IF 'delivery' = ANY(service_styles) THEN
      final_capabilities := final_capabilities || delivery_capabilities;
    END IF;
    
    -- Add common capabilities
    final_capabilities := final_capabilities || ARRAY[
      'schedule', 'service_pricing', 'booking_create', 'booking_view',
      'custom_services', 'package_management', 'pricing'
    ];
    
    -- Remove duplicates
    SELECT array_agg(DISTINCT unnest) INTO final_capabilities
    FROM unnest(final_capabilities);
    
    -- Remove denied capabilities for solo
    IF vendor_config = 'solo' THEN
      -- Check if custom_services is allowed for solo (from config)
      IF NOT (role_config->'capabilityRules'->'solo'->>'allowCustomServicesForSolo')::boolean THEN
        final_capabilities := array_remove(final_capabilities, 'custom_services');
        final_capabilities := array_remove(final_capabilities, 'custom_packages');
      END IF;
      
      -- Remove business-only capabilities
      final_capabilities := array_remove(final_capabilities, 'staff_management');
      final_capabilities := array_remove(final_capabilities, 'staff_create');
      final_capabilities := array_remove(final_capabilities, 'staff_schedule');
      final_capabilities := array_remove(final_capabilities, 'inventory_manage');
      final_capabilities := array_remove(final_capabilities, 'inventory');
      final_capabilities := array_remove(final_capabilities, 'center_profile');
    END IF;
    
    -- Delete existing permissions for this role
    DELETE FROM role_permissions
    WHERE role_permissions.role_id = current_role_id;
    
    -- Insert new permissions
    FOREACH cap IN ARRAY final_capabilities
    LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      VALUES (current_role_id, cap, '*', '*')
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Mapped % capabilities to role: %', array_length(final_capabilities, 1), role_name;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
  total_roles INTEGER;
  roles_with_caps INTEGER;
  avg_caps NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_roles FROM roles WHERE is_active = true;
  
  SELECT COUNT(DISTINCT role_id) INTO roles_with_caps FROM role_permissions;
  
  SELECT AVG(cap_count) INTO avg_caps
  FROM (
    SELECT role_id, COUNT(*) as cap_count
    FROM role_permissions
    GROUP BY role_id
  ) sub;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CAPABILITY MAPPING COMPLETE';
  RAISE NOTICE '  Total Roles: %', total_roles;
  RAISE NOTICE '  Roles with Capabilities: %', roles_with_caps;
  RAISE NOTICE '  Average Capabilities per Role: %', ROUND(avg_caps, 1);
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check capabilities per role
-- SELECT 
--   r.name,
--   r.customer_service,
--   r.config->>'vendorConfiguration' as vendor_config,
--   COUNT(rp.permission_name) as capability_count,
--   array_agg(rp.permission_name ORDER BY rp.permission_name) as capabilities
-- FROM roles r
-- LEFT JOIN role_permissions rp ON r.id = rp.role_id
-- WHERE r.is_active = true
-- GROUP BY r.id, r.name, r.customer_service, r.config->>'vendorConfiguration'
-- ORDER BY r.customer_service, r.name;

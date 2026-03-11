-- ============================================================================
-- MIGRATION 051: SEED ROLE PERMISSIONS FOR ALL 20 ROLES
-- ============================================================================
-- Date: 2026-01-XX
-- Purpose: Seed role_permissions table with capabilities for all 20 vendor roles
-- Maps frontend capabilities to backend permissions
-- ============================================================================

-- Helper function to insert permissions for a role
CREATE OR REPLACE FUNCTION insert_role_permissions(
    p_role_name TEXT,
    p_permissions TEXT[]
) RETURNS void AS $$
DECLARE
    v_role_id UUID;
    v_permission TEXT;
BEGIN
    -- Get role ID
    SELECT id INTO v_role_id FROM roles WHERE name = p_role_name;
    
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found', p_role_name;
    END IF;
    
    -- Insert each permission
    FOREACH v_permission IN ARRAY p_permissions
    LOOP
        INSERT INTO role_permissions (role_id, permission_name, resource, action)
        VALUES (v_role_id, v_permission, 'vendor', 'manage')
        ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HEALTHCARE ROLES (1-7)
-- ============================================================================

-- 1. Veterinarian
SELECT insert_role_permissions('veterinarian', ARRAY[
    'medical_records',
    'prescription_create',
    'diagnostic_results',
    'booking_create',
    'booking_view',
    'service_pricing',
    'staff_create',
    'staff_schedule'
]);

-- 2. Vet Clinic
SELECT insert_role_permissions('vet_clinic', ARRAY[
    'medical_records',
    'prescription_create',
    'diagnostic_results',
    'staff_create',
    'staff_schedule',
    'booking_create',
    'service_pricing',
    'inventory_manage'
]);

-- 3. Ambulance
SELECT insert_role_permissions('ambulance', ARRAY[
    'gps_tracking',
    'booking_create',
    'booking_view',
    'service_pricing'
]);

-- 4. Diagnostics Center
SELECT insert_role_permissions('diagnostics_center', ARRAY[
    'diagnostic_results',
    'booking_create',
    'service_pricing',
    'staff_create'
]);

-- 5. Pharmacy
-- ✅ PHARMACY FIX: Add all required capabilities for Pharmacy role
-- Core: inventory, catalog, orders, delivery
-- Healthcare: prescription verification
-- Operations: expiry management, order dispatch, availability check
SELECT insert_role_permissions('pharmacy', ARRAY[
    'inventory_manage',
    'product_catalog',
    'orders',
    'order_dispatch',
    'order_broadcast',
    'availability_check',
    'prescription_create',
    'prescription_verification',
    'delivery',
    'expiry_management',
    'controlled_substances'
]);

-- 6. Pet Nutritionist
SELECT insert_role_permissions('pet_nutritionist', ARRAY[
    'booking_create',
    'service_pricing',
    'medical_records'
]);

-- 7. Pet Insurance
SELECT insert_role_permissions('pet_insurance', ARRAY[
    'booking_create',
    'service_pricing'
]);

-- ============================================================================
-- SERVICE PROVIDER ROLES (8-15)
-- ============================================================================

-- 8. Pet Groomer
SELECT insert_role_permissions('pet_groomer', ARRAY[
    'booking_create',
    'booking_view',
    'service_pricing',
    'staff_schedule'
]);

-- 9. Pet Trainer
SELECT insert_role_permissions('pet_trainer', ARRAY[
    'booking_create',
    'service_pricing',
    'staff_create'
]);

-- 10. Pet Walker
SELECT insert_role_permissions('pet_walker', ARRAY[
    'gps_tracking',
    'booking_create',
    'booking_view'
]);

-- 11. Pet Sitter
SELECT insert_role_permissions('pet_sitter', ARRAY[
    'booking_create',
    'booking_view',
    'service_pricing'
]);

-- 12. Pet Boarder
SELECT insert_role_permissions('pet_boarder', ARRAY[
    'booking_create',
    'service_pricing',
    'staff_create',
    'inventory_manage'
]);

-- 13. Pet Transport
SELECT insert_role_permissions('pet_transport', ARRAY[
    'gps_tracking',
    'booking_create',
    'booking_view'
]);

-- 14. Pet Photographer
SELECT insert_role_permissions('pet_photographer', ARRAY[
    'booking_create',
    'service_pricing'
]);

-- 15. Pet Spa
SELECT insert_role_permissions('pet_spa', ARRAY[
    'booking_create',
    'service_pricing',
    'staff_create',
    'staff_schedule'
]);

-- ============================================================================
-- HOSPITALITY & RETAIL ROLES (16-20)
-- ============================================================================

-- 16. Pet Cafe
SELECT insert_role_permissions('pet_cafe', ARRAY[
    'booking_create',
    'inventory_manage',
    'product_catalog',
    'staff_create',
    'cafe_tables'
]);

-- 17. Pet Adoption Center
SELECT insert_role_permissions('pet_adoption_center', ARRAY[
    'booking_create',
    'medical_records',
    'staff_create',
    'adoption'
]);

-- 18. Pet Event Organizer
SELECT insert_role_permissions('pet_event_organizer', ARRAY[
    'booking_create',
    'service_pricing'
]);

-- 19. Pet Relocation
SELECT insert_role_permissions('pet_relocation', ARRAY[
    'booking_create',
    'service_pricing',
    'gps_tracking'
]);

-- 20. Pet Daycare
SELECT insert_role_permissions('pet_daycare', ARRAY[
    'booking_create',
    'service_pricing',
    'staff_create',
    'staff_schedule'
]);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all roles have permissions
DO $$
DECLARE
    v_role_count INTEGER;
    v_permission_count INTEGER;
BEGIN
    -- Count roles with permissions
    SELECT COUNT(DISTINCT r.id) INTO v_role_count
    FROM roles r
    INNER JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true;
    
    -- Count total permissions
    SELECT COUNT(*) INTO v_permission_count
    FROM role_permissions;
    
    RAISE NOTICE '✅ Successfully seeded permissions for % roles', v_role_count;
    RAISE NOTICE '✅ Total permissions created: %', v_permission_count;
    
    IF v_role_count < 20 THEN
        RAISE WARNING 'Expected 20 roles with permissions, found %', v_role_count;
    END IF;
END $$;

-- ============================================================================
-- CLEANUP HELPER FUNCTION
-- ============================================================================

-- Drop helper function (optional, can keep for future use)
-- DROP FUNCTION IF EXISTS insert_role_permissions(TEXT, TEXT[]);


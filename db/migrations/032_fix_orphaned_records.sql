-- ============================================================================
-- MIGRATION: 032_fix_orphaned_records.sql
-- ============================================================================
-- Phase 3, Task 3.2: Fix Orphaned Records
-- 
-- Purpose: Clean up orphaned records before adding foreign key constraints
-- This migration must be run BEFORE applying foreign key constraints
-- to avoid constraint violations
--
-- Date: 2025-01-27
-- ============================================================================

DO $$
DECLARE
    default_role_id UUID;
    fixed_vendors_count INTEGER := 0;
    fixed_bookings_count INTEGER := 0;
    fixed_services_count INTEGER := 0;
BEGIN
    -- ========================================================================
    -- 1. Fix vendors without roles
    -- ========================================================================
    -- Get a default role ID (or create one if needed)
    -- First, try to get an existing role
    SELECT id INTO default_role_id 
    FROM roles 
    WHERE name = 'default' OR is_system_role = true 
    ORDER BY is_system_role DESC, created_at ASC 
    LIMIT 1;
    
    -- If no default role exists, try any active role
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id 
        FROM roles 
        WHERE is_active = true 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;
    
    -- Update vendors without roles (only if not rejected)
    IF default_role_id IS NOT NULL THEN
        UPDATE vendors
        SET role_id = default_role_id,
            updated_at = NOW()
        WHERE role_id IS NULL 
          AND status != 'rejected'
          AND status != 'inactive';
        
        GET DIAGNOSTICS fixed_vendors_count = ROW_COUNT;
        
        IF fixed_vendors_count > 0 THEN
            RAISE NOTICE 'Fixed % vendors without roles (assigned default role: %)', 
                fixed_vendors_count, default_role_id;
        ELSE
            RAISE NOTICE 'No vendors without roles found';
        END IF;
    ELSE
        RAISE WARNING 'No default role found. Cannot fix vendors without roles. Please create a default role first.';
    END IF;

    -- ========================================================================
    -- 2. Fix bookings without vendors
    -- ========================================================================
    -- Mark bookings without vendors as cancelled
    UPDATE bookings
    SET status = 'cancelled',
        cancellation_reason = 'Vendor no longer available (data cleanup)',
        cancelled_at = COALESCE(cancelled_at, NOW()),
        updated_at = NOW()
    WHERE vendor_id IS NULL 
      AND status IN ('pending', 'confirmed', 'in_progress');
    
    GET DIAGNOSTICS fixed_bookings_count = ROW_COUNT;
    
    IF fixed_bookings_count > 0 THEN
        RAISE NOTICE 'Fixed % bookings without vendors (marked as cancelled)', 
            fixed_bookings_count;
    ELSE
        RAISE NOTICE 'No bookings without vendors found';
    END IF;

    -- ========================================================================
    -- 3. Fix services without vendors
    -- ========================================================================
    -- Deactivate services without vendors
    UPDATE services
    SET is_active = false,
        updated_at = NOW()
    WHERE vendor_id IS NULL 
      AND is_active = true;
    
    GET DIAGNOSTICS fixed_services_count = ROW_COUNT;
    
    IF fixed_services_count > 0 THEN
        RAISE NOTICE 'Fixed % services without vendors (deactivated)', 
            fixed_services_count;
    ELSE
        RAISE NOTICE 'No services without vendors found';
    END IF;

    -- Summary
    RAISE NOTICE 'Migration 032_fix_orphaned_records completed:';
    RAISE NOTICE '  - Vendors fixed: %', fixed_vendors_count;
    RAISE NOTICE '  - Bookings fixed: %', fixed_bookings_count;
    RAISE NOTICE '  - Services fixed: %', fixed_services_count;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to verify before migration)
-- ============================================================================
-- 
-- Check for orphaned records BEFORE running migration:
--
-- -- 1. Count vendors without roles
-- SELECT COUNT(*) as vendors_without_roles
-- FROM vendors
-- WHERE role_id IS NULL AND status != 'rejected';
--
-- -- 2. List vendors without roles (sample)
-- SELECT id, business_name, status, created_at
-- FROM vendors
-- WHERE role_id IS NULL AND status != 'rejected'
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- -- 3. Count bookings without vendors
-- SELECT COUNT(*) as bookings_without_vendors
-- FROM bookings
-- WHERE vendor_id IS NULL AND status IN ('pending', 'confirmed', 'in_progress');
--
-- -- 4. List bookings without vendors (sample)
-- SELECT id, customer_id, service_id, status, booking_date, created_at
-- FROM bookings
-- WHERE vendor_id IS NULL AND status IN ('pending', 'confirmed', 'in_progress')
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- -- 5. Count services without vendors
-- SELECT COUNT(*) as services_without_vendors
-- FROM services
-- WHERE vendor_id IS NULL AND is_active = true;
--
-- -- 6. List services without vendors (sample)
-- SELECT id, name, category, price, is_active, created_at
-- FROM services
-- WHERE vendor_id IS NULL AND is_active = true
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
--
-- Verify no orphaned records remain:
--
-- -- All vendors should have roles (except rejected/inactive)
-- SELECT COUNT(*) as vendors_still_without_roles
-- FROM vendors
-- WHERE role_id IS NULL AND status NOT IN ('rejected', 'inactive');
-- -- Should return 0
--
-- -- No active bookings without vendors
-- SELECT COUNT(*) as active_bookings_without_vendors
-- FROM bookings
-- WHERE vendor_id IS NULL AND status IN ('pending', 'confirmed', 'in_progress');
-- -- Should return 0
--
-- -- No active services without vendors
-- SELECT COUNT(*) as active_services_without_vendors
-- FROM services
-- WHERE vendor_id IS NULL AND is_active = true;
-- -- Should return 0
-- ============================================================================


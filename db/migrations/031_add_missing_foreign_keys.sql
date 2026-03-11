-- ============================================================================
-- MIGRATION: 031_add_missing_foreign_keys.sql
-- ============================================================================
-- Phase 3, Task 3.1: Add Missing Foreign Keys
-- 
-- Purpose: Add foreign key constraints that are missing from the schema
-- to ensure referential integrity
--
-- Date: 2025-01-27
-- ============================================================================

DO $$
BEGIN
    -- ========================================================================
    -- 1. Add foreign key for vendors.role_id
    -- ========================================================================
    -- Note: vendors.role_id currently only has a comment, no constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vendors_role_id_fkey'
    ) THEN
        ALTER TABLE vendors 
        ADD CONSTRAINT vendors_role_id_fkey 
        FOREIGN KEY (role_id) REFERENCES roles(id) 
        ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added foreign key: vendors_role_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key vendors_role_id_fkey already exists, skipping';
    END IF;

    -- ========================================================================
    -- 2. Add foreign key for bookings.vendor_id (if not already exists)
    -- ========================================================================
    -- Note: schema.sql has inline REFERENCES, but explicit constraint ensures
    -- it exists with proper name and behavior
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_vendor_id_fkey'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_vendor_id_fkey 
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) 
        ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added foreign key: bookings_vendor_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key bookings_vendor_id_fkey already exists, skipping';
    END IF;

    -- ========================================================================
    -- 3. Add foreign key for bookings.staff_id (if not already exists)
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_staff_id_fkey'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES staff(id) 
        ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added foreign key: bookings_staff_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key bookings_staff_id_fkey already exists, skipping';
    END IF;

    -- ========================================================================
    -- 4. Add foreign key for services.vendor_id (if not already exists)
    -- ========================================================================
    -- Note: schema.sql has inline REFERENCES with ON DELETE CASCADE
    -- This ensures consistency with schema.sql behavior
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'services_vendor_id_fkey'
    ) THEN
        ALTER TABLE services 
        ADD CONSTRAINT services_vendor_id_fkey 
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key: services_vendor_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key services_vendor_id_fkey already exists, skipping';
    END IF;

    RAISE NOTICE 'Migration 031_add_missing_foreign_keys completed successfully';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to verify)
-- ============================================================================
-- 
-- Verify foreign keys were created:
-- SELECT 
--     tc.constraint_name, 
--     tc.table_name, 
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name,
--     rc.delete_rule
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints AS rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name IN ('vendors', 'bookings', 'services')
--   AND tc.constraint_name IN (
--       'vendors_role_id_fkey',
--       'bookings_vendor_id_fkey',
--       'bookings_staff_id_fkey',
--       'services_vendor_id_fkey'
--   )
-- ORDER BY tc.table_name, tc.constraint_name;
-- ============================================================================


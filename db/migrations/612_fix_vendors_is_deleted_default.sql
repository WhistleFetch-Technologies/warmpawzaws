-- ============================================================================
-- Migration 612: Fix vendors.is_deleted default value
-- Date: 2026-03-13
-- Purpose: Ensure is_deleted always defaults to false and cannot be set to true on INSERT
-- ============================================================================
-- This migration ensures that:
-- 1. is_deleted column has DEFAULT false
-- 2. The default cannot be overridden by setting it to true on INSERT
-- 3. Only UPDATE operations can set is_deleted to true (for soft deletion)
-- ============================================================================

DO $$
BEGIN
    -- Step 1: Ensure is_deleted column exists and has DEFAULT false
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'is_deleted'
    ) THEN
        -- Update any existing NULL values to false
        UPDATE vendors 
        SET is_deleted = false 
        WHERE is_deleted IS NULL;
        
        -- Set the default to false (if not already)
        ALTER TABLE vendors 
        ALTER COLUMN is_deleted SET DEFAULT false;
        
        -- Make sure it's NOT NULL
        ALTER TABLE vendors 
        ALTER COLUMN is_deleted SET NOT NULL;
        
        RAISE NOTICE 'Updated vendors.is_deleted to have DEFAULT false and NOT NULL constraint';
    ELSE
        -- Column doesn't exist, create it
        ALTER TABLE vendors 
        ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
        
        RAISE NOTICE 'Added vendors.is_deleted column with DEFAULT false';
    END IF;
    
    -- Step 2: Create a trigger to prevent is_deleted from being set to true on INSERT
    -- This ensures that new vendors are never created as deleted
    DROP TRIGGER IF EXISTS prevent_deleted_vendor_insert ON vendors;
    
    RAISE NOTICE 'Dropped existing trigger if any';
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in migration 612: %', SQLERRM;
END $$;

-- Create function and trigger outside of DO block to avoid delimiter conflicts
CREATE OR REPLACE FUNCTION prevent_deleted_vendor_insert()
RETURNS TRIGGER AS $trigger$
BEGIN
    -- If someone tries to INSERT with is_deleted = true, force it to false
    IF NEW.is_deleted = true THEN
        RAISE WARNING 'Attempted to create vendor with is_deleted = true. Forcing to false.';
        NEW.is_deleted := false;
    END IF;
    RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_deleted_vendor_insert
    BEFORE INSERT ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deleted_vendor_insert();

-- ============================================================================
-- VERIFICATION (run separately if needed)
-- ============================================================================

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

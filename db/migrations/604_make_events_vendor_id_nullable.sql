-- ============================================================================
-- MIGRATION 604: Make vendor_id nullable in events table for admin-created events
-- ============================================================================
-- Purpose: Allow admin-created events to have null vendor_id
-- Date: 2026-02-24
-- ============================================================================

DO $$
BEGIN
    -- Check if vendor_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'vendor_id' AND is_nullable = 'NO'
    ) THEN
        -- Drop the foreign key constraint first (if it exists)
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'events_vendor_id_fkey' AND conrelid = 'events'::regclass
        ) THEN
            ALTER TABLE events DROP CONSTRAINT events_vendor_id_fkey;
            RAISE NOTICE 'Dropped foreign key constraint events_vendor_id_fkey.';
        END IF;
        
        -- Make vendor_id nullable
        ALTER TABLE events ALTER COLUMN vendor_id DROP NOT NULL;
        RAISE NOTICE 'Made vendor_id nullable in events table.';
        
        -- Re-add the foreign key constraint with ON DELETE SET NULL for admin events
        ALTER TABLE events 
        ADD CONSTRAINT events_vendor_id_fkey 
        FOREIGN KEY (vendor_id) 
        REFERENCES vendors(id) 
        ON DELETE CASCADE;
        RAISE NOTICE 'Re-added foreign key constraint events_vendor_id_fkey.';
    ELSE
        RAISE NOTICE 'vendor_id column is already nullable or does not exist.';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Migration 604_make_events_vendor_id_nullable.sql failed: %', SQLERRM;
END $$;

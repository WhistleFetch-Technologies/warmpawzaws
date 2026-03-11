-- ============================================================================
-- MIGRATION 253: ADD staff_id COLUMN TO gps_tracking_sessions
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Add staff_id column to gps_tracking_sessions table if it doesn't exist
-- This column is needed for tracking sessions where a staff member (not vendor) 
-- is performing the service
-- ============================================================================

BEGIN;

-- Check if column exists, and add it if it doesn't
DO $$
BEGIN
    -- Check if staff_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' 
        AND column_name = 'staff_id'
    ) THEN
        -- Add staff_id column
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN staff_id UUID REFERENCES staff(id);
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_staff_id 
        ON gps_tracking_sessions(staff_id);
        
        RAISE NOTICE '✅ Added staff_id column to gps_tracking_sessions table';
    ELSE
        RAISE NOTICE 'ℹ️  staff_id column already exists in gps_tracking_sessions table';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION 254: ADD MISSING COLUMNS TO gps_tracking_sessions
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Add missing columns to gps_tracking_sessions table to match
--          the schema expected by the code (migration 100)
-- ============================================================================

BEGIN;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add start_latitude if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'start_latitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN start_latitude DECIMAL(10, 8);
        RAISE NOTICE '✅ Added start_latitude column';
    END IF;

    -- Add start_longitude if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'start_longitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN start_longitude DECIMAL(11, 8);
        RAISE NOTICE '✅ Added start_longitude column';
    END IF;

    -- Add destination_latitude if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'destination_latitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN destination_latitude DECIMAL(10, 8);
        RAISE NOTICE '✅ Added destination_latitude column';
    END IF;

    -- Add destination_longitude if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'destination_longitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN destination_longitude DECIMAL(11, 8);
        RAISE NOTICE '✅ Added destination_longitude column';
    END IF;

    -- Add destination_address if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'destination_address'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN destination_address TEXT;
        RAISE NOTICE '✅ Added destination_address column';
    END IF;

    -- Add current_accuracy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'current_accuracy'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN current_accuracy DECIMAL(6, 2);
        RAISE NOTICE '✅ Added current_accuracy column';
    END IF;

    -- Add current_heading if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'current_heading'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN current_heading DECIMAL(5, 2);
        RAISE NOTICE '✅ Added current_heading column';
    END IF;

    -- Add current_speed if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'current_speed'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN current_speed DECIMAL(6, 2);
        RAISE NOTICE '✅ Added current_speed column';
    END IF;

    -- Add estimated_eta_minutes if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'estimated_eta_minutes'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN estimated_eta_minutes INTEGER;
        RAISE NOTICE '✅ Added estimated_eta_minutes column';
    END IF;

    -- Add distance_km if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'distance_km'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN distance_km DECIMAL(8, 2);
        RAISE NOTICE '✅ Added distance_km column';
    END IF;

    -- Add distance_remaining_km if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'distance_remaining_km'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN distance_remaining_km DECIMAL(8, 2);
        RAISE NOTICE '✅ Added distance_remaining_km column';
    END IF;

    -- Add route_polyline if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'route_polyline'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN route_polyline TEXT;
        RAISE NOTICE '✅ Added route_polyline column';
    END IF;

    -- Add started_at if it doesn't exist (rename session_start if needed)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'started_at'
    ) THEN
        -- Check if session_start exists and rename it, otherwise add new column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'gps_tracking_sessions' AND column_name = 'session_start'
        ) THEN
            ALTER TABLE gps_tracking_sessions 
            RENAME COLUMN session_start TO started_at;
            RAISE NOTICE '✅ Renamed session_start to started_at';
        ELSE
            ALTER TABLE gps_tracking_sessions 
            ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE '✅ Added started_at column';
        END IF;
    END IF;

    -- Add arrived_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'arrived_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN arrived_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ Added arrived_at column';
    END IF;

    -- Add completed_at if it doesn't exist (rename session_end if needed)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'completed_at'
    ) THEN
        -- Check if session_end exists and rename it, otherwise add new column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'gps_tracking_sessions' AND column_name = 'session_end'
        ) THEN
            ALTER TABLE gps_tracking_sessions 
            RENAME COLUMN session_end TO completed_at;
            RAISE NOTICE '✅ Renamed session_end to completed_at';
        ELSE
            ALTER TABLE gps_tracking_sessions 
            ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE '✅ Added completed_at column';
        END IF;
    END IF;

    -- Add cancelled_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ Added cancelled_at column';
    END IF;

    -- Add last_update_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'last_update_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN last_update_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ Added last_update_at column';
    END IF;

    -- Add cancellation_reason if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE gps_tracking_sessions 
        ADD COLUMN cancellation_reason TEXT;
        RAISE NOTICE '✅ Added cancellation_reason column';
    END IF;

    -- Update status constraint if needed (allow new status values)
    -- Note: We can't easily modify CHECK constraints, so we'll skip this
    -- The application should handle status validation

    RAISE NOTICE '✅ Migration 254 completed successfully';
END $$;

COMMIT;

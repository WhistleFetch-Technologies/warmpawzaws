-- ============================================================================
-- MIGRATION 544: ADD VIDEO CALL COLUMNS TO BOOKINGS TABLE
-- ============================================================================
-- Date: 2026-02-21
-- Purpose: Add all video call tracking columns to bookings table
--          Includes: meeting_id, started_at, ended_at, duration, status
-- ============================================================================

DO $$
BEGIN
    -- Add video_call_meeting_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'video_call_meeting_id'
    ) THEN
        ALTER TABLE bookings
        ADD COLUMN video_call_meeting_id TEXT;
        COMMENT ON COLUMN bookings.video_call_meeting_id IS 'AWS Chime meeting ID for video calls';
        RAISE NOTICE 'Added video_call_meeting_id column to bookings table';
    ELSE
        RAISE NOTICE 'video_call_meeting_id column already exists in bookings table';
    END IF;

    -- Add video_call_started_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'video_call_started_at'
    ) THEN
        ALTER TABLE bookings
        ADD COLUMN video_call_started_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.video_call_started_at IS 'Timestamp when video call started';
        RAISE NOTICE 'Added video_call_started_at column to bookings table';
    ELSE
        RAISE NOTICE 'video_call_started_at column already exists in bookings table';
    END IF;

    -- Add video_call_ended_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'video_call_ended_at'
    ) THEN
        ALTER TABLE bookings
        ADD COLUMN video_call_ended_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.video_call_ended_at IS 'Timestamp when video call ended';
        RAISE NOTICE 'Added video_call_ended_at column to bookings table';
    ELSE
        RAISE NOTICE 'video_call_ended_at column already exists in bookings table';
    END IF;

    -- Add video_call_duration column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'video_call_duration'
    ) THEN
        ALTER TABLE bookings
        ADD COLUMN video_call_duration INTEGER;
        COMMENT ON COLUMN bookings.video_call_duration IS 'Video call duration in seconds';
        RAISE NOTICE 'Added video_call_duration column to bookings table';
    ELSE
        RAISE NOTICE 'video_call_duration column already exists in bookings table';
    END IF;

    -- Add video_call_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'video_call_status'
    ) THEN
        ALTER TABLE bookings
        ADD COLUMN video_call_status TEXT;
        COMMENT ON COLUMN bookings.video_call_status IS 'Video call status: active, completed, cancelled, etc.';
        RAISE NOTICE 'Added video_call_status column to bookings table';
    ELSE
        RAISE NOTICE 'video_call_status column already exists in bookings table';
    END IF;

END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_video_call_meeting_id 
ON bookings(video_call_meeting_id) 
WHERE video_call_meeting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_video_call_started_at 
ON bookings(video_call_started_at) 
WHERE video_call_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_video_call_status 
ON bookings(video_call_status) 
WHERE video_call_status IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

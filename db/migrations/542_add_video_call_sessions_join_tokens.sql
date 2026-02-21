-- ============================================================================
-- MIGRATION 542: ADD JOIN TOKENS AND STAFF_ID TO VIDEO_CALL_SESSIONS
-- ============================================================================
-- Date: 2026-02-21
-- Purpose: Add customer_join_token, vendor_join_token, and staff_id columns
--          to video_call_sessions table for Chime SDK integration
-- ============================================================================

DO $$
BEGIN
    -- Add customer_join_token column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND column_name = 'customer_join_token'
    ) THEN
        ALTER TABLE video_call_sessions
        ADD COLUMN customer_join_token TEXT;
        COMMENT ON COLUMN video_call_sessions.customer_join_token IS 'AWS Chime join token for customer attendee';
        RAISE NOTICE 'Added customer_join_token column to video_call_sessions table';
    ELSE
        RAISE NOTICE 'customer_join_token column already exists in video_call_sessions table';
    END IF;

    -- Add vendor_join_token column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND column_name = 'vendor_join_token'
    ) THEN
        ALTER TABLE video_call_sessions
        ADD COLUMN vendor_join_token TEXT;
        COMMENT ON COLUMN video_call_sessions.vendor_join_token IS 'AWS Chime join token for vendor attendee';
        RAISE NOTICE 'Added vendor_join_token column to video_call_sessions table';
    ELSE
        RAISE NOTICE 'vendor_join_token column already exists in video_call_sessions table';
    END IF;

    -- Add staff_id column (optional, for staff members joining calls)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND column_name = 'staff_id'
    ) THEN
        ALTER TABLE video_call_sessions
        ADD COLUMN staff_id UUID REFERENCES staff(id);
        COMMENT ON COLUMN video_call_sessions.staff_id IS 'Optional staff member ID if staff is joining the call';
        RAISE NOTICE 'Added staff_id column to video_call_sessions table';
    ELSE
        RAISE NOTICE 'staff_id column already exists in video_call_sessions table';
    END IF;

    -- Update status constraint to include 'waiting' and 'ended' if needed
    -- Check if constraint exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND constraint_name = 'video_call_sessions_status_check'
    ) THEN
        -- Drop old constraint
        ALTER TABLE video_call_sessions DROP CONSTRAINT video_call_sessions_status_check;
        -- Add new constraint with all valid statuses
        ALTER TABLE video_call_sessions
        ADD CONSTRAINT video_call_sessions_status_check
        CHECK (status IN ('active', 'waiting', 'completed', 'cancelled', 'ended'));
        RAISE NOTICE 'Updated status constraint to include waiting and ended';
    END IF;

END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

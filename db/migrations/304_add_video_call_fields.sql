-- ============================================================================
-- MIGRATION 304: Add Video Call Fields to Bookings Table
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add video call tracking fields to bookings table
-- Phase: Phase 3 - Video Call Integration
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- ============================================================================

-- Add video_call_meeting_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'video_call_meeting_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN video_call_meeting_id VARCHAR(255);
        COMMENT ON COLUMN bookings.video_call_meeting_id IS 'AWS Chime meeting ID for video calls';
    END IF;
END $$;

-- Add video_call_started_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'video_call_started_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN video_call_started_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.video_call_started_at IS 'Timestamp when video call started';
    END IF;
END $$;

-- Add video_call_ended_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'video_call_ended_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN video_call_ended_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.video_call_ended_at IS 'Timestamp when video call ended';
    END IF;
END $$;

-- Add video_call_duration integer column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'video_call_duration'
    ) THEN
        ALTER TABLE bookings ADD COLUMN video_call_duration INTEGER;
        COMMENT ON COLUMN bookings.video_call_duration IS 'Video call duration in seconds';
    END IF;
END $$;

-- Create index on video_call_meeting_id for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_video_call_meeting_id ON bookings(video_call_meeting_id) WHERE video_call_meeting_id IS NOT NULL;

-- Create index on video_call_started_at for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_video_call_started_at ON bookings(video_call_started_at) WHERE video_call_started_at IS NOT NULL;

COMMENT ON TABLE bookings IS 'Bookings with video call tracking';

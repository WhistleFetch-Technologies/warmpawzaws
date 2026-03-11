-- ============================================================================
-- VIDEO CALL AND PACKAGE SESSION TABLES
-- ============================================================================
-- Migration: Phase 2.3 - Booking Lifecycle Features
-- Date: 2025-01-28
-- 
-- Tables for video calling and package session tracking
-- ============================================================================

-- Video Call Sessions
CREATE TABLE IF NOT EXISTS video_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    meeting_id TEXT NOT NULL, -- AWS Chime Meeting ID
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    customer_attendee_id TEXT, -- AWS Chime Attendee ID
    vendor_attendee_id TEXT, -- AWS Chime Attendee ID
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER, -- Calculated duration
    recording_url TEXT, -- If recording was enabled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id)
);

-- Package Sessions
CREATE TABLE IF NOT EXISTS package_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    outcome TEXT, -- 'success', 'partial', 'needs_followup', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id, session_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_sessions_booking_id 
ON video_call_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_video_sessions_meeting_id 
ON video_call_sessions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_video_sessions_status 
ON video_call_sessions(status);

CREATE INDEX IF NOT EXISTS idx_package_sessions_booking_id 
ON package_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_package_sessions_status 
ON package_sessions(status);

-- Add comments
COMMENT ON TABLE video_call_sessions IS 'Video call sessions for tele consultations using AWS Chime';
COMMENT ON TABLE package_sessions IS 'Individual sessions within a package booking';


-- ============================================================================
-- GPS TRACKING & TELE SESSION TABLES
-- ============================================================================
-- Migration: Add tables for home service GPS tracking and tele consultation sessions
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- GPS TRACKING SESSIONS (for home services)
-- ============================================================================
-- Replaces: session:tracking:{trackingId} KV keys

CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    tracking_id TEXT NOT NULL UNIQUE,
    
    -- Location Data
    start_location JSONB, -- { lat, lng, address }
    current_location JSONB, -- { lat, lng, timestamp }
    waypoints JSONB DEFAULT '[]', -- Array of { lat, lng, timestamp }
    
    -- Tracking Metrics
    total_distance_km NUMERIC(8, 2) DEFAULT 0,
    estimated_eta_minutes INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gps_tracking_booking ON gps_tracking_sessions(booking_id);
CREATE INDEX idx_gps_tracking_tracking_id ON gps_tracking_sessions(tracking_id);
CREATE INDEX idx_gps_tracking_active ON gps_tracking_sessions(is_active) WHERE is_active = true;

COMMENT ON TABLE gps_tracking_sessions IS 'GPS tracking sessions for home service bookings - replaces session:tracking:{trackingId} KV keys';
COMMENT ON COLUMN gps_tracking_sessions.waypoints IS 'Array of location waypoints with timestamps';

-- ============================================================================
-- TELE CONSULTATION SESSIONS
-- ============================================================================
-- Replaces: tele_session:{sessionId} KV keys

CREATE TABLE IF NOT EXISTS tele_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    
    -- Call Details
    call_status TEXT NOT NULL DEFAULT 'ringing' CHECK (call_status IN ('ringing', 'active', 'ended', 'rejected', 'cancelled')),
    initiated_by TEXT NOT NULL CHECK (initiated_by IN ('customer', 'staff')),
    initiated_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    ended_by TEXT CHECK (ended_by IN ('customer', 'staff')),
    
    -- Duration
    duration_seconds INTEGER DEFAULT 0,
    
    -- Video Call Integration
    session_link TEXT,
    meeting_id TEXT,
    attendee_tokens JSONB, -- { customer: token, staff: token }
    
    -- Chat
    chat_enabled BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tele_sessions_booking ON tele_sessions(booking_id);
CREATE INDEX idx_tele_sessions_customer ON tele_sessions(customer_id);
CREATE INDEX idx_tele_sessions_staff ON tele_sessions(staff_id);
CREATE INDEX idx_tele_sessions_status ON tele_sessions(call_status);

COMMENT ON TABLE tele_sessions IS 'Tele consultation video call sessions - replaces tele_session:{sessionId} KV keys';
COMMENT ON COLUMN tele_sessions.call_status IS 'Current status of the video call';

-- ============================================================================
-- TELE CONSULTATION QUEUES
-- ============================================================================
-- Replaces: tele:queue:{queueId} KV keys

CREATE TABLE IF NOT EXISTS tele_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT NOT NULL, -- 'veterinarian', 'trainer', 'nutritionist', etc.
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    -- Queue Position
    queue_position INTEGER NOT NULL,
    
    -- Timing
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    estimated_wait_minutes INTEGER,
    waiting_time_seconds INTEGER DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'completed', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tele_queues_role ON tele_queues(role_id);
CREATE INDEX idx_tele_queues_booking ON tele_queues(booking_id);
CREATE INDEX idx_tele_queues_status ON tele_queues(status);
CREATE INDEX idx_tele_queues_role_status ON tele_queues(role_id, status);

COMMENT ON TABLE tele_queues IS 'Queue management for instant tele consultations - replaces tele:queue:{queueId} KV keys';

-- ============================================================================
-- BOOKING STATUS HISTORY (for tracking status transitions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Status Change
    from_status TEXT,
    to_status TEXT NOT NULL,
    
    -- Metadata
    changed_by TEXT, -- 'customer', 'vendor', 'staff', 'system'
    changed_by_id UUID, -- ID of the person/system that made the change
    note TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_status_history_booking ON booking_status_history(booking_id);
CREATE INDEX idx_booking_status_history_created ON booking_status_history(created_at DESC);

COMMENT ON TABLE booking_status_history IS 'Audit trail of booking status changes';


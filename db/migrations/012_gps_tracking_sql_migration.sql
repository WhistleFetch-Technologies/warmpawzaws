-- ============================================================================
-- MIGRATION 012: GPS Tracking SQL Migration
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Replace KV-based GPS tracking with SQL tables
-- ============================================================================

-- ============================================================================
-- GPS TRACKING SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL, -- Maps: session:tracking:{sessionId} KV key
    booking_id UUID REFERENCES bookings(id),
    walker_id UUID REFERENCES staff(id),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    
    -- Location Data
    current_location JSONB NOT NULL, -- {lat, lng, timestamp}
    route JSONB DEFAULT '[]', -- Array of {lat, lng, timestamp, speed?, heading?}
    
    -- Metrics
    distance_km NUMERIC(10, 2) DEFAULT 0,
    speed_kmh NUMERIC(5, 2),
    heading_degrees NUMERIC(5, 2),
    
    -- ETA
    eta_minutes INTEGER,
    estimated_arrival TIMESTAMPTZ,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_update TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_session_id ON gps_tracking_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_booking_id ON gps_tracking_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_walker_id ON gps_tracking_sessions(walker_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_status ON gps_tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_sessions_last_update ON gps_tracking_sessions(last_update);

COMMENT ON TABLE gps_tracking_sessions IS 'GPS tracking sessions - replaces session:tracking:{sessionId} KV keys';

-- ============================================================================
-- GPS TRACKING HISTORY (Optional: for historical route data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gps_tracking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL, -- References gps_tracking_sessions.session_id
    location JSONB NOT NULL, -- {lat, lng, timestamp, speed?, heading?}
    distance_from_start NUMERIC(10, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (session_id) REFERENCES gps_tracking_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_session_id ON gps_tracking_history(session_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_history_recorded_at ON gps_tracking_history(recorded_at);

COMMENT ON TABLE gps_tracking_history IS 'Historical GPS tracking points for detailed route analysis';


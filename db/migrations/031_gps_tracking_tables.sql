-- ============================================================================
-- GPS TRACKING TABLES
-- ============================================================================
-- Migration: Phase 2.3 - Booking Lifecycle Features
-- Date: 2025-01-28
-- 
-- Tables for GPS tracking of home service bookings
-- ============================================================================

-- GPS Tracking Sessions
CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_update TIMESTAMPTZ DEFAULT NOW(),
    initial_latitude NUMERIC(10, 8),
    initial_longitude NUMERIC(11, 8),
    final_latitude NUMERIC(10, 8),
    final_longitude NUMERIC(11, 8),
    total_distance NUMERIC(10, 2) DEFAULT 0, -- in meters
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GPS Tracking Points
CREATE TABLE IF NOT EXISTS gps_tracking_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    session_id UUID REFERENCES gps_tracking_sessions(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy NUMERIC(8, 2), -- in meters
    speed NUMERIC(6, 2), -- in m/s
    heading NUMERIC(5, 2), -- in degrees (0-360)
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gps_sessions_booking_id 
ON gps_tracking_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_gps_sessions_vendor_id 
ON gps_tracking_sessions(vendor_id);

CREATE INDEX IF NOT EXISTS idx_gps_sessions_status 
ON gps_tracking_sessions(status);

CREATE INDEX IF NOT EXISTS idx_gps_points_booking_id 
ON gps_tracking_points(booking_id);

CREATE INDEX IF NOT EXISTS idx_gps_points_session_id 
ON gps_tracking_points(session_id);

CREATE INDEX IF NOT EXISTS idx_gps_points_timestamp 
ON gps_tracking_points(timestamp DESC);

-- Add comments
COMMENT ON TABLE gps_tracking_sessions IS 'Active GPS tracking sessions for home service bookings';
COMMENT ON TABLE gps_tracking_points IS 'Individual GPS location points recorded during tracking';


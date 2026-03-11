-- ============================================================================
-- MIGRATION 201: Home Service and Scheduling Enhancements
-- ============================================================================
-- Date: 2026-01-19
-- Purpose: Add home service settings and scheduling enhancements for all roles
-- ============================================================================

-- ============================================================================
-- VENDOR HOME SERVICE SETTINGS
-- ============================================================================

-- Add home service settings columns to vendors table if not exists
DO $$
BEGIN
    -- Add home_service_enabled column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'home_service_enabled'
    ) THEN
        ALTER TABLE vendors ADD COLUMN home_service_enabled BOOLEAN DEFAULT false;
    END IF;
    
    -- Add home_service_operating_hours column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'home_service_operating_hours'
    ) THEN
        ALTER TABLE vendors ADD COLUMN home_service_operating_hours JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add current location columns if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'current_latitude'
    ) THEN
        ALTER TABLE vendors ADD COLUMN current_latitude NUMERIC(10, 8);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'current_longitude'
    ) THEN
        ALTER TABLE vendors ADD COLUMN current_longitude NUMERIC(11, 8);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'location_updated_at'
    ) THEN
        ALTER TABLE vendors ADD COLUMN location_updated_at TIMESTAMPTZ;
    END IF;
    
    -- Add home_booking_settings if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'home_booking_settings'
    ) THEN
        ALTER TABLE vendors ADD COLUMN home_booking_settings JSONB DEFAULT '{
            "instantBookingEnabled": false,
            "advanceBookingDays": 30,
            "minimumNoticeMinutes": 60,
            "maxDailyHomeBookings": 5
        }'::jsonb;
    END IF;
END$$;

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_vendors_current_location ON vendors(current_latitude, current_longitude) WHERE current_latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_home_service ON vendors(home_service_enabled, service_radius) WHERE home_service_enabled = true;

-- ============================================================================
-- STAFF SCHEDULING ENHANCEMENTS (using existing staff_availability table)
-- ============================================================================

-- Add service_styles column to staff_availability if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_availability' AND column_name = 'service_styles'
    ) THEN
        ALTER TABLE staff_availability ADD COLUMN service_styles TEXT[] DEFAULT ARRAY['at_center'];
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_availability' AND column_name = 'home_service_area_km'
    ) THEN
        ALTER TABLE staff_availability ADD COLUMN home_service_area_km NUMERIC(5, 2);
    END IF;
END$$;

-- ============================================================================
-- HOME SERVICE TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS home_service_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Session Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'vendor_en_route',
        'vendor_arrived',
        'start_otp_verified',
        'in_progress',
        'end_otp_pending',
        'completed',
        'cancelled'
    )),
    
    -- OTP Verification
    start_otp TEXT,
    start_otp_verified_at TIMESTAMPTZ,
    end_otp TEXT,
    end_otp_verified_at TIMESTAMPTZ,
    
    -- Location Tracking
    destination_address TEXT,
    destination_latitude NUMERIC(10, 8),
    destination_longitude NUMERIC(11, 8),
    
    -- Vendor Journey
    vendor_started_at TIMESTAMPTZ,
    vendor_arrived_at TIMESTAMPTZ,
    session_started_at TIMESTAMPTZ,
    session_completed_at TIMESTAMPTZ,
    
    -- Route Data (for walkers/sitters)
    route_data JSONB DEFAULT '[]'::jsonb,
    total_distance_km NUMERIC(8, 2),
    route_start_time TIMESTAMPTZ,
    route_end_time TIMESTAMPTZ,
    
    -- ETA
    current_eta_minutes INTEGER,
    last_eta_update TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_sessions_booking ON home_service_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_home_sessions_vendor ON home_service_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_home_sessions_status ON home_service_sessions(status);
CREATE INDEX IF NOT EXISTS idx_home_sessions_active ON home_service_sessions(vendor_id, status) 
    WHERE status NOT IN ('completed', 'cancelled');

-- ============================================================================
-- VENDOR REAL-TIME TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_live_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    session_id UUID REFERENCES home_service_sessions(id) ON DELETE CASCADE,
    
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy_meters NUMERIC(8, 2),
    heading_degrees NUMERIC(5, 2),
    speed_kmh NUMERIC(5, 2),
    
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_locations_vendor_time ON vendor_live_locations(vendor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_locations_session ON vendor_live_locations(session_id) WHERE session_id IS NOT NULL;

-- Auto-cleanup old locations (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_vendor_locations()
RETURNS void AS $$
BEGIN
    DELETE FROM vendor_live_locations 
    WHERE recorded_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PACKAGE UTILIZATION TRACKING ENHANCEMENT
-- ============================================================================

-- Add utilization_tracking column to package_purchases if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'package_purchases' AND column_name = 'utilization_details'
    ) THEN
        ALTER TABLE package_purchases ADD COLUMN utilization_details JSONB DEFAULT '{
            "completed_sessions": 0,
            "pending_sessions": 0,
            "cancelled_sessions": 0,
            "service_breakdown": {}
        }'::jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'package_purchases' AND column_name = 'next_session_info'
    ) THEN
        ALTER TABLE package_purchases ADD COLUMN next_session_info JSONB;
    END IF;
END$$;

-- ============================================================================
-- SCHEDULING POLICY ENHANCEMENTS
-- ============================================================================

-- Check if scheduling_policies table exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'scheduling_policies'
    ) THEN
        -- Add new scheduling policies for home services
        INSERT INTO scheduling_policies (policy_name, policy_type, policy_config) VALUES
        ('Home Service Travel Policy', 'commute_time', '{"maxTravelTimeMinutes": 60, "trafficBufferMultiplier": 1.3, "minBufferBetweenHomeServices": 30, "maxHomeServicesPerDay": 8}'),
        ('Walker Session Policy', 'package_session', '{"requireRouteTracking": true, "minWalkDurationMinutes": 15, "maxWalkDurationMinutes": 120, "requireStartEndOTP": true}'),
        ('Sitter Session Policy', 'package_session', '{"requireStartEndOTP": true, "trackDuration": true, "allowMultiplePetsPerSession": true, "maxSessionHours": 12}')
        ON CONFLICT (policy_name) DO NOTHING;
    END IF;
END$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE home_service_sessions IS 'Tracks home service sessions with OTP verification and route tracking';
COMMENT ON TABLE vendor_live_locations IS 'Real-time GPS locations for vendors during home services';


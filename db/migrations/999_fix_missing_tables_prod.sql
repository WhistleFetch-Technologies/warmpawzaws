-- ============================================================================
-- MIGRATION 999: Fix Missing Tables for Production
-- Purpose: Create vendor_availability_v2 and add missing columns to gps_tracking_sessions
-- ============================================================================

-- Create vendor_availability_v2 table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    staff_id UUID,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    service_type VARCHAR(100),
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele')),
    time_window_start TIME,
    time_window_end TIME,
    slot_duration_minutes INTEGER DEFAULT 30,
    service_area_km NUMERIC(5, 2),
    max_capacity INTEGER DEFAULT 1,
    service_styles TEXT[] DEFAULT '{}',
    location_data JSONB,
    buffer_time INTEGER DEFAULT 15,
    lead_time_by_style JSONB,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (
        (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time) OR
        (time_window_start IS NOT NULL AND time_window_end IS NOT NULL AND time_window_end > time_window_start)
    )
);

COMMENT ON TABLE vendor_availability_v2 IS 'Vendor and staff availability schedules';
COMMENT ON COLUMN vendor_availability_v2.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';

-- Create indexes for vendor_availability_v2
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_vendor_day ON vendor_availability_v2(vendor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_service_style ON vendor_availability_v2(service_style);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_staff ON vendor_availability_v2(staff_id);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_service_styles ON vendor_availability_v2 USING GIN(service_styles);

-- Add missing columns to gps_tracking_sessions
DO $$ 
BEGIN
    -- Add vendor_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'vendor_id'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN vendor_id UUID;
    END IF;

    -- Add customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN customer_id UUID;
    END IF;

    -- Add staff_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'staff_id'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN staff_id UUID;
    END IF;

    -- Add status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'status'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN status VARCHAR(50) DEFAULT 'active' 
        CHECK (status IN ('active', 'completed', 'cancelled', 'in_transit', 'arrived'));
        -- Set status based on is_active
        UPDATE gps_tracking_sessions SET status = CASE 
            WHEN is_active = true THEN 'active'
            WHEN stopped_at IS NOT NULL THEN 'completed'
            ELSE 'active'
        END WHERE status IS NULL;
    END IF;

    -- Add current_latitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'current_latitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN current_latitude DECIMAL(10, 8);
        -- Extract from current_location JSONB if it exists
        UPDATE gps_tracking_sessions 
        SET current_latitude = (current_location->>'lat')::DECIMAL(10, 8)
        WHERE current_location IS NOT NULL AND current_latitude IS NULL;
    END IF;

    -- Add current_longitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'current_longitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN current_longitude DECIMAL(11, 8);
        -- Extract from current_location JSONB if it exists
        UPDATE gps_tracking_sessions 
        SET current_longitude = (current_location->>'lng')::DECIMAL(11, 8)
        WHERE current_location IS NOT NULL AND current_longitude IS NULL;
    END IF;

    -- Add destination_latitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'destination_latitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN destination_latitude DECIMAL(10, 8);
    END IF;

    -- Add destination_longitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'destination_longitude'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN destination_longitude DECIMAL(11, 8);
    END IF;

    -- Add distance_remaining_km
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'distance_remaining_km'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN distance_remaining_km NUMERIC(10, 2);
    END IF;

    -- Add arrived_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'arrived_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN arrived_at TIMESTAMP;
    END IF;

    -- Add last_update_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gps_tracking_sessions' AND column_name = 'last_update_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions ADD COLUMN last_update_at TIMESTAMP;
        -- Copy from updated_at if it exists
        UPDATE gps_tracking_sessions 
        SET last_update_at = updated_at 
        WHERE last_update_at IS NULL AND updated_at IS NOT NULL;
    END IF;
END $$;

-- Create indexes for gps_tracking_sessions
CREATE INDEX IF NOT EXISTS idx_gps_tracking_vendor ON gps_tracking_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_customer ON gps_tracking_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_staff_id ON gps_tracking_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_status ON gps_tracking_sessions(status);

-- Add foreign key constraints if tables exist (safe to ignore if they don't)
DO $$ 
BEGIN
    -- Add foreign key for vendor_availability_v2.vendor_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'vendor_availability_v2' 
            AND constraint_name = 'vendor_availability_v2_vendor_id_fkey'
        ) THEN
            ALTER TABLE vendor_availability_v2 
            ADD CONSTRAINT vendor_availability_v2_vendor_id_fkey 
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

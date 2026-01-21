-- Migration: Add Missing Service Features (Phase 1.1)
-- Purpose: Add service_radius (at_home), queue_config (tele), consultation_rooms (business), staff pricing (already exists)
-- Date: 2025-01-30

BEGIN;

-- ============================================================================
-- 1. ADD SERVICE RADIUS (for at_home services)
-- ============================================================================

ALTER TABLE vendor_services 
ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(5, 2) DEFAULT NULL;

COMMENT ON COLUMN vendor_services.service_radius_km IS 'Service coverage radius in kilometers for at_home services. NULL means unlimited or uses vendor default.';

-- ============================================================================
-- 2. ADD QUEUE CONFIGURATION (for tele services)
-- ============================================================================

ALTER TABLE vendor_services 
ADD COLUMN IF NOT EXISTS queue_config JSONB DEFAULT NULL;

COMMENT ON COLUMN vendor_services.queue_config IS 'Queue configuration for tele services: max_queue_size, avg_wait_time_minutes, auto_accept, priority_rules';

-- Example queue_config structure:
-- {
--   "max_queue_size": 10,
--   "avg_wait_time_minutes": 15,
--   "auto_accept": false,
--   "priority_rules": {
--     "premium_customers": true,
--     "vip_priority": true
--   }
-- }

-- ============================================================================
-- 3. CREATE CONSULTATION ROOMS TABLE (for business/clinic vendors)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultation_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    centre_id UUID REFERENCES vendor_centres(id) ON DELETE CASCADE, -- Optional: room can be at vendor or centre level
    room_number TEXT NOT NULL,
    room_name TEXT, -- e.g., "Consultation Room 1", "Surgery Room"
    room_type TEXT DEFAULT 'consultation' CHECK (room_type IN ('consultation', 'surgery', 'examination', 'procedure', 'other')),
    is_active BOOLEAN DEFAULT true,
    capacity INTEGER DEFAULT 1, -- Number of concurrent consultations
    amenities JSONB DEFAULT '[]'::jsonb, -- e.g., ["xray", "ultrasound", "surgery_table"]
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, room_number, COALESCE(centre_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

COMMENT ON TABLE consultation_rooms IS 'Consultation rooms for business/clinic vendors. Used for managing room availability and scheduling.';

CREATE INDEX IF NOT EXISTS idx_consultation_rooms_vendor_id ON consultation_rooms(vendor_id);
CREATE INDEX IF NOT EXISTS idx_consultation_rooms_centre_id ON consultation_rooms(centre_id) WHERE centre_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultation_rooms_active ON consultation_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_consultation_rooms_type ON consultation_rooms(room_type);

-- ============================================================================
-- 4. CREATE ROOM AVAILABILITY TABLE (for room scheduling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES consultation_rooms(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    blocked_until TIMESTAMPTZ, -- Temporary block (e.g., maintenance)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(room_id, day_of_week, start_time, end_time)
);

COMMENT ON TABLE room_availability IS 'Weekly availability schedule for consultation rooms. Used to prevent double-booking.';

CREATE INDEX IF NOT EXISTS idx_room_availability_room_id ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_vendor_id ON room_availability(vendor_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_day_time ON room_availability(day_of_week, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_room_availability_available ON room_availability(is_available) WHERE is_available = true;

-- ============================================================================
-- 5. LINK BOOKINGS TO ROOMS (add room_id to bookings if not exists)
-- ============================================================================

-- Check if room_id column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'room_id'
    ) THEN
        ALTER TABLE bookings 
        ADD COLUMN room_id UUID REFERENCES consultation_rooms(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id) WHERE room_id IS NOT NULL;
        
        COMMENT ON COLUMN bookings.room_id IS 'Assigned consultation room for at_center service bookings';
    END IF;
END $$;

-- ============================================================================
-- 6. VERIFY STAFF PRICING EXISTS (already in staff_services table)
-- ============================================================================

-- staff_services.price already exists (migration 007_discovery_sql_migration.sql)
-- No changes needed - staff pricing is already supported

-- ============================================================================
-- 7. CREATE UPDATED_AT TRIGGER FOR NEW TABLES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultation_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consultation_rooms_updated_at
    BEFORE UPDATE ON consultation_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_consultation_rooms_updated_at();

CREATE TRIGGER trigger_update_room_availability_updated_at
    BEFORE UPDATE ON room_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_consultation_rooms_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify columns added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_services' AND column_name = 'service_radius_km'
    ) THEN
        RAISE EXCEPTION 'service_radius_km column not added';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_services' AND column_name = 'queue_config'
    ) THEN
        RAISE EXCEPTION 'queue_config column not added';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'consultation_rooms'
    ) THEN
        RAISE EXCEPTION 'consultation_rooms table not created';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'room_availability'
    ) THEN
        RAISE EXCEPTION 'room_availability table not created';
    END IF;
    
    RAISE NOTICE '✅ All missing service features added successfully';
END $$;

COMMIT;

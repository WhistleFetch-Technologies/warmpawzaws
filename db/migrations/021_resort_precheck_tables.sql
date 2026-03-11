-- ============================================================================
-- RESORT/BOARDING PRE-CHECK TABLES
-- ============================================================================
-- 
-- Tables for resort and boarding pre-check forms, room configurations,
-- and availability management.
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- RESORT PRE-CHECK FORMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS resort_precheck_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pre_check_id TEXT NOT NULL UNIQUE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    pet_name TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Health Information (JSONB)
    health_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Vaccination Records (JSONB)
    vaccinations JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Emergency Contacts (JSONB array)
    emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Special Requirements (JSONB)
    special_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Veterinarian Information (JSONB)
    veterinarian JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Authorization (JSONB)
    authorization JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'clarification_needed'
    )),
    review_notes TEXT,
    reviewed_by UUID REFERENCES staff(id),
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_resort_precheck_booking ON resort_precheck_forms(booking_id);
CREATE INDEX idx_resort_precheck_vendor ON resort_precheck_forms(vendor_id);
CREATE INDEX idx_resort_precheck_customer ON resort_precheck_forms(customer_id);
CREATE INDEX idx_resort_precheck_status ON resort_precheck_forms(status);
CREATE INDEX idx_resort_precheck_precheck_id ON resort_precheck_forms(pre_check_id);

COMMENT ON TABLE resort_precheck_forms IS 'Resort/boarding pre-check forms - maps from resort:precheck:{preCheckId} KV keys';

-- ============================================================================
-- RESORT ROOM CONFIGURATIONS
-- ============================================================================
-- Note: boarding_rooms table already exists (015_boarding_rooms_table.sql)
-- This table extends it for resort-specific room configurations with pricing

CREATE TABLE IF NOT EXISTS resort_room_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    room_type TEXT NOT NULL CHECK (room_type IN (
        'standard',
        'deluxe',
        'suite',
        'outdoor',
        'climate_controlled'
    )),
    room_size TEXT NOT NULL CHECK (room_size IN (
        'small',
        'medium',
        'large',
        'extra_large'
    )),
    
    total_rooms INTEGER NOT NULL CHECK (total_rooms > 0),
    available_rooms INTEGER NOT NULL DEFAULT 0 CHECK (available_rooms >= 0),
    
    -- Features array (JSONB)
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Pricing (JSONB)
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Amenities (JSONB)
    amenities JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    pet_size_limit TEXT NOT NULL DEFAULT 'any' CHECK (pet_size_limit IN (
        'small',
        'medium',
        'large',
        'any'
    )),
    max_occupancy INTEGER NOT NULL DEFAULT 1 CHECK (max_occupancy > 0),
    
    -- Photos array (JSONB)
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_resort_room_config_vendor ON resort_room_configurations(vendor_id);
CREATE INDEX idx_resort_room_config_active ON resort_room_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_resort_room_config_config_id ON resort_room_configurations(config_id);
CREATE INDEX idx_resort_room_config_type ON resort_room_configurations(room_type);

COMMENT ON TABLE resort_room_configurations IS 'Resort room configurations - maps from resort:room:{configId} KV keys';

-- ============================================================================
-- RESORT AVAILABILITY CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS resort_availability_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    availability_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    room_type TEXT NOT NULL,
    date DATE NOT NULL,
    
    total_capacity INTEGER NOT NULL DEFAULT 0,
    booked_count INTEGER NOT NULL DEFAULT 0,
    available_count INTEGER NOT NULL DEFAULT 0,
    
    -- Blocked slots (JSONB array)
    blocked_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Pricing (JSONB)
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(vendor_id, room_type, date)
);

CREATE INDEX idx_resort_availability_vendor_date ON resort_availability_calendar(vendor_id, date);
CREATE INDEX idx_resort_availability_room_type ON resort_availability_calendar(room_type);
CREATE INDEX idx_resort_availability_date ON resort_availability_calendar(date);

COMMENT ON TABLE resort_availability_calendar IS 'Resort availability calendar for date-based room availability';

-- ============================================================================
-- UPDATE BOOKINGS TABLE (add pre-check fields if not exist)
-- ============================================================================
-- Note: Check if columns exist before adding to avoid errors

DO $$ 
BEGIN
    -- Add pre_check_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'pre_check_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN pre_check_id TEXT;
        CREATE INDEX idx_bookings_pre_check_id ON bookings(pre_check_id);
    END IF;
    
    -- Add pre_check_status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'pre_check_status'
    ) THEN
        ALTER TABLE bookings ADD COLUMN pre_check_status TEXT CHECK (pre_check_status IN (
            'pending',
            'submitted',
            'under_review',
            'approved',
            'rejected',
            'clarification_needed'
        ));
        CREATE INDEX idx_bookings_pre_check_status ON bookings(pre_check_status);
    END IF;
    
    -- Add special_requirements if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'special_requirements'
    ) THEN
        ALTER TABLE bookings ADD COLUMN special_requirements JSONB;
    END IF;
END $$;


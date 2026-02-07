-- ============================================================================
-- ADVANCED SCHEDULING MANAGEMENT TABLES
-- ============================================================================
-- Date: 2026-01-27
-- Purpose: Support advanced scheduling with breaks, holidays, buffer time,
--          and service-specific slot availability
-- ============================================================================

-- Create vendor_slot_services table (service-specific slot availability)
CREATE TABLE IF NOT EXISTS vendor_slot_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES vendor_availability_v2(id) ON DELETE CASCADE,
    service_id UUID REFERENCES vendor_services(id) ON DELETE CASCADE,
    service_style VARCHAR(50),
    buffer_time_minutes INTEGER DEFAULT 0,
    max_capacity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_slot_services_slot_id 
    ON vendor_slot_services(slot_id);
CREATE INDEX IF NOT EXISTS idx_vendor_slot_services_service_id 
    ON vendor_slot_services(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_slot_services_service_style 
    ON vendor_slot_services(service_style) WHERE service_style IS NOT NULL;

COMMENT ON TABLE vendor_slot_services IS 'Service-specific availability for each slot (multiple services per slot allowed)';
COMMENT ON COLUMN vendor_slot_services.buffer_time_minutes IS 'Buffer time required after this service in this slot';

-- Create vendor_slot_breaks table (breaks within slots)
CREATE TABLE IF NOT EXISTS vendor_slot_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES vendor_availability_v2(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_break_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_vendor_slot_breaks_slot_id 
    ON vendor_slot_breaks(slot_id);

COMMENT ON TABLE vendor_slot_breaks IS 'Breaks within availability slots (lunch, tea, etc.)';

-- Create vendor_holidays table (holidays for solo providers)
CREATE TABLE IF NOT EXISTS vendor_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_holidays_vendor_id 
    ON vendor_holidays(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_holidays_date 
    ON vendor_holidays(holiday_date);

COMMENT ON TABLE vendor_holidays IS 'Holidays for vendors (blocks all slots on these dates)';

-- Ensure vendor_availability_v2 has required columns
DO $$
BEGIN
    -- Add buffer_time_minutes if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_availability_v2' AND column_name = 'buffer_time_minutes'
    ) THEN
        ALTER TABLE vendor_availability_v2 ADD COLUMN buffer_time_minutes INTEGER DEFAULT 0;
        COMMENT ON COLUMN vendor_availability_v2.buffer_time_minutes IS 'Default buffer time for this slot (can be overridden per service)';
    END IF;

    -- Add max_capacity if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_availability_v2' AND column_name = 'max_capacity'
    ) THEN
        ALTER TABLE vendor_availability_v2 ADD COLUMN max_capacity INTEGER DEFAULT 1;
        COMMENT ON COLUMN vendor_availability_v2.max_capacity IS 'Maximum concurrent bookings per slot';
    END IF;

    -- Add location if not exists (for solo/staff slots)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_availability_v2' AND column_name = 'location'
    ) THEN
        ALTER TABLE vendor_availability_v2 ADD COLUMN location JSONB;
        COMMENT ON COLUMN vendor_availability_v2.location IS 'Location for this slot (for solo/staff with multiple locations)';
    END IF;
END $$;


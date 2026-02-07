-- ============================================================================
-- Migration: 422_ensure_staff_scheduling_tables.sql
-- Description: Ensures staff scheduling tables exist (from migration 073)
--              This is a safety migration to ensure tables are created if
--              migration 073 was not applied or partially applied.
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- 1. STAFF AVAILABILITY SLOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Slot timing
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Location override (defaults to vendor location or staff default_location)
    location_override JSONB,
    
    -- Slot configuration
    is_available BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_slots_staff_date 
ON staff_availability_slots(staff_id, date);

CREATE INDEX IF NOT EXISTS idx_staff_availability_slots_available 
ON staff_availability_slots(staff_id, date, start_time) 
WHERE is_available = true;

COMMENT ON TABLE staff_availability_slots IS 'Granular availability slots with location override support';

-- ============================================================================
-- 2. STAFF SLOT SERVICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_slot_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES staff_availability_slots(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Service-specific timing
    lead_time_minutes INTEGER DEFAULT 0,
    buffer_time_minutes INTEGER DEFAULT 0,
    
    -- Radius for home services (km)
    radius_km NUMERIC(5, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(slot_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_slot_services_slot 
ON staff_slot_services(slot_id);

CREATE INDEX IF NOT EXISTS idx_staff_slot_services_service 
ON staff_slot_services(service_id);

COMMENT ON TABLE staff_slot_services IS 'Services available in each slot with timing and radius configuration';

-- ============================================================================
-- 3. STAFF SLOT BREAKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_slot_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES staff_availability_slots(id) ON DELETE CASCADE,
    
    -- Break timing
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT break_within_slot CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_staff_slot_breaks_slot 
ON staff_slot_breaks(slot_id);

COMMENT ON TABLE staff_slot_breaks IS 'Breaks within availability slots';

-- ============================================================================
-- 4. STAFF TELE AVAILABILITY TABLE (for instant tele-queue)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_tele_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT false,
    available_until TIMESTAMPTZ,
    last_online TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tele_availability_available
ON staff_tele_availability(is_available, staff_id)
WHERE is_available = true;

COMMENT ON TABLE staff_tele_availability IS 'Staff availability status for instant tele consultations';

-- ============================================================================
-- 5. ENSURE STAFF_SERVICES HAS REQUIRED COLUMNS
-- ============================================================================

-- Add service_style column if not exists (from migration 007)
ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele'));

-- Add service_styles array column if not exists (from migration 073)
ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS service_styles TEXT[] DEFAULT '{}';

-- Add other useful columns from migration 073
ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS lead_time_minutes INTEGER DEFAULT 0;

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS buffer_time_minutes INTEGER DEFAULT 0;

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS radius_km NUMERIC(5, 2);

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS enabled_by_staff BOOLEAN DEFAULT false;

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS assigned_by_vendor BOOLEAN DEFAULT true;

-- ============================================================================
-- 6. TELE QUEUE TABLE (for instant consultations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tele_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'connecting', 'in_progress', 'completed', 'cancelled', 'expired')),
    notes TEXT,
    assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    connected_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Add assigned_staff_id column if table exists but column doesn't
ALTER TABLE tele_queue 
ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tele_queue_status
ON tele_queue(status, created_at)
WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_tele_queue_customer
ON tele_queue(customer_id);

-- Only create staff index if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tele_queue' AND column_name = 'assigned_staff_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_tele_queue_staff
        ON tele_queue(assigned_staff_id)
        WHERE assigned_staff_id IS NOT NULL;
    END IF;
END $$;

COMMENT ON TABLE tele_queue IS 'Queue for instant tele consultations';

-- ============================================================================
-- 7. NOTIFICATIONS TABLE (ensure recipient_type supports 'staff')
-- ============================================================================

-- Check if notifications table exists and add index for staff notifications
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- Create index for staff notifications if not exists
        CREATE INDEX IF NOT EXISTS idx_notifications_staff_recipient
        ON notifications(recipient_id, recipient_type)
        WHERE recipient_type = 'staff';
    END IF;
END $$;

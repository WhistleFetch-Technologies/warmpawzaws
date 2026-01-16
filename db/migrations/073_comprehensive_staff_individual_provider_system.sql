-- ============================================================================
-- Migration: 073_comprehensive_staff_individual_provider_system.sql
-- Description: Comprehensive staff and individual provider system with
--              granular scheduling, service management, location override
-- Date: 2025-01-28
-- ============================================================================

-- ============================================================================
-- 1. INDIVIDUAL PROVIDER SUPPORT
-- ============================================================================

-- Make vendor_id nullable for individual providers (home groomer, vet, trainer)
ALTER TABLE staff 
ALTER COLUMN vendor_id DROP NOT NULL;

-- Add individual provider flag
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS is_individual_provider BOOLEAN DEFAULT false;

-- Update unique constraint to allow same phone for different vendors or individual providers
ALTER TABLE staff 
DROP CONSTRAINT IF EXISTS staff_vendor_id_phone_key;

-- New unique constraint: phone must be unique globally (for login)
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_phone_unique 
ON staff(phone) 
WHERE is_active = true;

-- ============================================================================
-- 2. MANDATORY FIELDS
-- ============================================================================

-- Add mandatory fields
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS photo TEXT;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS qualifications TEXT; -- Degree/certifications

-- Note: specializations already exist in staff_specializations table
-- We'll enforce at least one specialization in application logic

-- Add default location (for individual providers or staff override)
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS default_location JSONB; -- {address, lat, lng, place_id, formatted_address}

COMMENT ON COLUMN staff.photo IS 'MANDATORY: Staff photo URL';
COMMENT ON COLUMN staff.qualifications IS 'MANDATORY: Degree, certifications, qualifications';
COMMENT ON COLUMN staff.default_location IS 'Default location (for individual providers) or override location';

-- ============================================================================
-- 3. ENHANCED STAFF AVAILABILITY SLOTS
-- ============================================================================

-- Create new comprehensive availability slots table
CREATE TABLE IF NOT EXISTS staff_availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Slot timing
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Location override (defaults to vendor location or staff default_location)
    location_override JSONB, -- {address, lat, lng, place_id, formatted_address}
    
    -- Slot configuration
    is_available BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent overlapping slots (enforced via application logic and unique index)
    -- Note: Overlap prevention handled in application layer for flexibility
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_slots_staff_date 
ON staff_availability_slots(staff_id, date);

CREATE INDEX IF NOT EXISTS idx_staff_availability_slots_available 
ON staff_availability_slots(staff_id, date, start_time) 
WHERE is_available = true;

COMMENT ON TABLE staff_availability_slots IS 'Granular availability slots with location override support';

-- ============================================================================
-- 4. SERVICES PER SLOT (with lead time, buffer, radius)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_slot_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES staff_availability_slots(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Service-specific timing
    lead_time_minutes INTEGER DEFAULT 0, -- Minutes before service starts
    buffer_time_minutes INTEGER DEFAULT 0, -- Minutes after service ends
    
    -- Radius for home services (km)
    radius_km NUMERIC(5, 2), -- For at_home services
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(slot_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_slot_services_slot 
ON staff_slot_services(slot_id);

CREATE INDEX IF NOT EXISTS idx_staff_slot_services_service 
ON staff_slot_services(service_id);

COMMENT ON TABLE staff_slot_services IS 'Services available in each slot with timing and radius configuration';

-- ============================================================================
-- 5. BREAKS PER SLOT
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_slot_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES staff_availability_slots(id) ON DELETE CASCADE,
    
    -- Break timing
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT, -- e.g., "Lunch", "Travel time"
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure break is within slot time (application logic)
    CONSTRAINT break_within_slot CHECK (
        start_time < end_time
    )
);

CREATE INDEX IF NOT EXISTS idx_staff_slot_breaks_slot 
ON staff_slot_breaks(slot_id);

COMMENT ON TABLE staff_slot_breaks IS 'Breaks within availability slots';

-- ============================================================================
-- 6. ENHANCED STAFF SERVICES CONFIGURATION
-- ============================================================================

-- Add service configuration columns
ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS service_styles TEXT[] DEFAULT '{}'; -- ['at_home', 'at_center', 'tele']

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS lead_time_minutes INTEGER DEFAULT 0;

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS buffer_time_minutes INTEGER DEFAULT 0;

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS radius_km NUMERIC(5, 2); -- For at_home services

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS enabled_by_staff BOOLEAN DEFAULT false; -- Staff can enable/disable

ALTER TABLE staff_services 
ADD COLUMN IF NOT EXISTS assigned_by_vendor BOOLEAN DEFAULT true; -- Assigned by business

COMMENT ON COLUMN staff_services.service_styles IS 'Service delivery styles: at_home, at_center, tele';
COMMENT ON COLUMN staff_services.lead_time_minutes IS 'Minutes before service starts (preparation time)';
COMMENT ON COLUMN staff_services.buffer_time_minutes IS 'Minutes after service ends (cleanup/travel buffer)';
COMMENT ON COLUMN staff_services.radius_km IS 'Service radius in km for at_home services';
COMMENT ON COLUMN staff_services.enabled_by_staff IS 'Whether staff has enabled this service (goes live immediately)';
COMMENT ON COLUMN staff_services.assigned_by_vendor IS 'Whether service was assigned by business owner';

-- ============================================================================
-- 7. STAFF LOCATION OVERRIDE HISTORY
-- ============================================================================

-- Track location overrides for analytics
CREATE TABLE IF NOT EXISTS staff_location_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES staff_availability_slots(id) ON DELETE CASCADE,
    
    -- Location data
    address TEXT NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    place_id TEXT, -- Google Places ID
    formatted_address TEXT,
    
    -- Override period (if null, applies to all future slots)
    valid_from DATE,
    valid_until DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- If slot_id is null, this is a default override
    -- If slot_id is set, this is slot-specific
);

CREATE INDEX IF NOT EXISTS idx_staff_location_overrides_staff 
ON staff_location_overrides(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_location_overrides_slot 
ON staff_location_overrides(slot_id);

COMMENT ON TABLE staff_location_overrides IS 'Location overrides for staff (default or per-slot)';

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for discovery queries (verified staff with services)
CREATE INDEX IF NOT EXISTS idx_staff_verified_active 
ON staff(mobile_verified, is_active) 
WHERE mobile_verified = true AND is_active = true;

-- Index for individual providers
CREATE INDEX IF NOT EXISTS idx_staff_individual_providers 
ON staff(is_individual_provider, mobile_verified, is_active) 
WHERE is_individual_provider = true AND mobile_verified = true AND is_active = true;

-- Index for staff services with styles
CREATE INDEX IF NOT EXISTS idx_staff_services_styles 
ON staff_services USING GIN(service_styles) 
WHERE enabled_by_staff = true AND is_active = true;

-- ============================================================================
-- 9. DATA MIGRATION
-- ============================================================================

-- Migrate existing staff_availability to new staff_availability_slots
INSERT INTO staff_availability_slots (staff_id, date, start_time, end_time, is_available)
SELECT staff_id, date, start_time, end_time, is_available
FROM staff_availability
ON CONFLICT DO NOTHING;

-- Set default location for existing staff from vendor location
UPDATE staff s
SET default_location = jsonb_build_object(
    'address', v.address,
    'lat', v.latitude::text,
    'lng', v.longitude::text,
    'formatted_address', v.address
)
FROM vendors v
WHERE s.vendor_id = v.id 
  AND s.default_location IS NULL
  AND v.latitude IS NOT NULL 
  AND v.longitude IS NOT NULL;

-- ============================================================================
-- 10. CONSTRAINTS & VALIDATIONS
-- ============================================================================

-- Ensure at least one specialization exists (application-level check)
-- We'll enforce this in backend validation

-- Ensure photo exists for active staff (application-level check)
-- We'll enforce this in backend validation

-- Ensure qualifications exist for active staff (application-level check)
-- We'll enforce this in backend validation

COMMENT ON TABLE staff IS 'Staff members and individual providers. vendor_id is NULL for individual providers.';

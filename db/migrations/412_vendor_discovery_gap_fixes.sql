-- ============================================================================
-- MIGRATION 412: Vendor Discovery Gap Fixes
-- ============================================================================
-- Date: 2026-01-27
-- Purpose: Fix gaps identified in vendor discovery and booking rules
-- 
-- Fixes:
-- 1. Add service_style to service_packages for style-based package filtering
-- 2. Add diagnostics enhancements (free collection, terms & conditions)
-- 3. Add chat auto-activation tracking for tele consultations
-- 4. Add sample collection notification tracking
-- ============================================================================

-- ============================================================================
-- 1. SERVICE PACKAGES: Add service_style column
-- ============================================================================

-- Add service_style column to service_packages
ALTER TABLE service_packages 
ADD COLUMN IF NOT EXISTS service_style VARCHAR(20) DEFAULT 'at_center'
CHECK (service_style IN ('at_center', 'at_home', 'tele'));

-- Add allowed_roles column to enforce role-based package rules
ALTER TABLE service_packages
ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN service_packages.service_style IS 'Service style for package: at_center (vet/grooming clinics), at_home (walker/trainer), tele (online consultations)';
COMMENT ON COLUMN service_packages.allowed_roles IS 'Roles that can use this package (e.g., trainer, walker for at_home)';

-- Add index for service_style filtering
CREATE INDEX IF NOT EXISTS idx_service_packages_service_style ON service_packages(service_style);

-- ============================================================================
-- 2. DIAGNOSTICS: Add free collection and terms & conditions
-- ============================================================================

-- Add new columns to diagnostic_tests
ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS is_free_home_collection BOOLEAN DEFAULT false;

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS home_collection_fee NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS turnaround_time_hours INTEGER;

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS is_package_available BOOLEAN DEFAULT false;

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS package_price NUMERIC(10, 2);

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS package_test_count INTEGER;

COMMENT ON COLUMN diagnostic_tests.is_free_home_collection IS 'Whether home sample collection is free for this test';
COMMENT ON COLUMN diagnostic_tests.home_collection_fee IS 'Fee for home sample collection if not free';
COMMENT ON COLUMN diagnostic_tests.terms_conditions IS 'Terms and conditions for this diagnostic test';
COMMENT ON COLUMN diagnostic_tests.turnaround_time_hours IS 'Expected time for results in hours';
COMMENT ON COLUMN diagnostic_tests.is_package_available IS 'Whether this test is available as a package';
COMMENT ON COLUMN diagnostic_tests.package_price IS 'Price for package of tests';
COMMENT ON COLUMN diagnostic_tests.package_test_count IS 'Number of tests included in package';

-- ============================================================================
-- 3. DIAGNOSTIC PACKAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS diagnostic_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    package_code TEXT,
    description TEXT,
    tests JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of test IDs with details
    total_price NUMERIC(10, 2) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    final_price NUMERIC(10, 2) NOT NULL,
    is_free_home_collection BOOLEAN DEFAULT false,
    home_collection_fee NUMERIC(10, 2) DEFAULT 0,
    terms_conditions TEXT,
    turnaround_time_hours INTEGER,
    validity_days INTEGER DEFAULT 30, -- How long the package is valid
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_packages_vendor ON diagnostic_packages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_packages_active ON diagnostic_packages(is_active);

COMMENT ON TABLE diagnostic_packages IS 'Diagnostic test packages offered by labs/centers';

-- Trigger for updated_at
CREATE TRIGGER trigger_update_diagnostic_packages_updated_at
    BEFORE UPDATE ON diagnostic_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

-- ============================================================================
-- 4. SAMPLE COLLECTION NOTIFICATIONS TRACKING
-- ============================================================================

-- Add notification tracking columns to sample_collection_assignments
ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_assigned BOOLEAN DEFAULT false;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_assigned_at TIMESTAMPTZ;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_on_way BOOLEAN DEFAULT false;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_on_way_at TIMESTAMPTZ;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_arrived BOOLEAN DEFAULT false;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_arrived_at TIMESTAMPTZ;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_collected BOOLEAN DEFAULT false;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS customer_notified_collected_at TIMESTAMPTZ;

-- Add staff details for customer notification
ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS staff_name TEXT;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS staff_phone TEXT;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS staff_photo_url TEXT;

ALTER TABLE sample_collection_assignments
ADD COLUMN IF NOT EXISTS estimated_arrival_time TIMESTAMPTZ;

COMMENT ON COLUMN sample_collection_assignments.customer_notified_assigned IS 'Whether customer was notified about staff assignment';
COMMENT ON COLUMN sample_collection_assignments.staff_name IS 'Name of staff coming for sample collection';
COMMENT ON COLUMN sample_collection_assignments.estimated_arrival_time IS 'ETA for staff arrival';

-- ============================================================================
-- 5. TELE CONSULTATION CHAT ACTIVATION
-- ============================================================================

-- Add chat activation tracking to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS chat_activated_at TIMESTAMPTZ;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS chat_auto_activated BOOLEAN DEFAULT false;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_5min_sent BOOLEAN DEFAULT false;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_5min_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.chat_activated_at IS 'When chat was activated for this booking (5 min before tele consultation)';
COMMENT ON COLUMN bookings.chat_auto_activated IS 'Whether chat was auto-activated before tele consultation';
COMMENT ON COLUMN bookings.reminder_5min_sent IS 'Whether 5-minute reminder was sent for tele consultation';

-- ============================================================================
-- 6. PACKAGE PURCHASES: Add service_style for filtering
-- ============================================================================

ALTER TABLE package_purchases
ADD COLUMN IF NOT EXISTS service_style VARCHAR(20);

COMMENT ON COLUMN package_purchases.service_style IS 'Service style inherited from package (at_center, at_home, tele)';

-- ============================================================================
-- 7. UPDATE DEFAULT service_style FOR EXISTING DATA (SAFE DEFAULTS)
-- ============================================================================

-- Update service_packages based on service_type where possible
UPDATE service_packages 
SET service_style = 'at_home'
WHERE service_style IS NULL
AND (
    service_type ILIKE '%walk%' 
    OR service_type ILIKE '%train%'
    OR service_type ILIKE '%sitter%'
);

UPDATE service_packages 
SET service_style = 'tele'
WHERE service_style IS NULL
AND (
    service_type ILIKE '%tele%' 
    OR service_type ILIKE '%video%'
    OR service_type ILIKE '%online%'
);

-- Set remaining NULL to at_center (default for vet/grooming clinics)
UPDATE service_packages 
SET service_style = 'at_center'
WHERE service_style IS NULL;


-- ============================================================================
-- MIGRATION 018: Holiday Packages Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create tables for holiday packages and bookings (replaces KV store)
-- ============================================================================

-- ============================================================================
-- HOLIDAY PACKAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS holiday_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    description TEXT,
    destination TEXT NOT NULL,
    destination_image TEXT,
    package_type TEXT NOT NULL CHECK (package_type IN ('beach', 'mountain', 'city', 'wildlife', 'adventure', 'luxury')),
    duration_days INTEGER NOT NULL,
    duration_nights INTEGER NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    price_per_pet NUMERIC(10, 2) NOT NULL,
    price_per_adult NUMERIC(10, 2) NOT NULL,
    price_per_child NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    inclusions JSONB DEFAULT '[]'::jsonb,
    exclusions JSONB DEFAULT '[]'::jsonb,
    is_group_tour BOOLEAN DEFAULT false,
    min_group_size INTEGER,
    max_group_size INTEGER,
    available_dates JSONB DEFAULT '[]'::jsonb,
    itinerary JSONB DEFAULT '[]'::jsonb,
    requirements JSONB DEFAULT '{}'::jsonb,
    cancellation_policy TEXT,
    refund_policy TEXT,
    rating NUMERIC(3, 2) DEFAULT 0,
    current_bookings INTEGER DEFAULT 0,
    max_capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holiday_packages_vendor_id ON holiday_packages(vendor_id);
CREATE INDEX idx_holiday_packages_active ON holiday_packages(vendor_id) WHERE is_active = true;
CREATE INDEX idx_holiday_packages_type ON holiday_packages(package_type);
CREATE INDEX idx_holiday_packages_destination ON holiday_packages(destination);

COMMENT ON TABLE holiday_packages IS 'Holiday packages - replaces holiday-package:{id} KV keys';

-- ============================================================================
-- HOLIDAY BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS holiday_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE,
    package_id TEXT NOT NULL REFERENCES holiday_packages(package_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    selected_start_date DATE NOT NULL,
    selected_end_date DATE NOT NULL,
    travelers JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    is_group_tour BOOLEAN DEFAULT false,
    group_members JSONB DEFAULT '[]'::jsonb,
    special_requests TEXT,
    dietary_requirements TEXT,
    cancellation_reason TEXT,
    refund_amount NUMERIC(10, 2),
    payment_id TEXT,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_holiday_bookings_package_id ON holiday_bookings(package_id);
CREATE INDEX idx_holiday_bookings_customer_id ON holiday_bookings(customer_id);
CREATE INDEX idx_holiday_bookings_vendor_id ON holiday_bookings(vendor_id);
CREATE INDEX idx_holiday_bookings_status ON holiday_bookings(status);
CREATE INDEX idx_holiday_bookings_dates ON holiday_bookings(selected_start_date, selected_end_date);

COMMENT ON TABLE holiday_bookings IS 'Holiday package bookings - replaces holiday_booking_{id} KV keys';


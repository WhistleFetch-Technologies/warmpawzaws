-- ============================================================================
-- MIGRATION 020: Adoption Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create tables for adoption listings and applications (replaces KV store)
-- ============================================================================

-- ============================================================================
-- ADOPTION LISTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS adoption_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    pet_name TEXT NOT NULL,
    pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'rabbit', 'bird', 'other')),
    breed TEXT,
    age INTEGER,
    age_unit TEXT CHECK (age_unit IN ('weeks', 'months', 'years')),
    gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
    size TEXT CHECK (size IN ('small', 'medium', 'large', 'extra_large')),
    color TEXT,
    description TEXT,
    medical_history TEXT,
    vaccination_status TEXT,
    spayed_neutered BOOLEAN,
    microchipped BOOLEAN,
    special_needs TEXT,
    photos TEXT[] DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    adoption_fee NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'adopted', 'withdrawn')),
    location_city TEXT,
    location_state TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    requirements JSONB DEFAULT '{}'::jsonb,
    application_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    adopted_at TIMESTAMPTZ
);

CREATE INDEX idx_adoption_listings_listing_id ON adoption_listings(listing_id);
CREATE INDEX idx_adoption_listings_vendor_id ON adoption_listings(vendor_id);
CREATE INDEX idx_adoption_listings_status ON adoption_listings(status) WHERE status = 'available';
CREATE INDEX idx_adoption_listings_pet_type ON adoption_listings(pet_type);

COMMENT ON TABLE adoption_listings IS 'Adoption listings - replaces adoption:{id} KV keys';

-- ============================================================================
-- ADOPTION APPLICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS adoption_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL REFERENCES adoption_listings(listing_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    applicant_address TEXT,
    application_message TEXT,
    previous_pet_experience TEXT,
    current_pets TEXT,
    living_situation TEXT,
    home_ownership TEXT,
    yard_space TEXT,
    work_schedule TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'withdrawn')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adoption_applications_application_id ON adoption_applications(application_id);
CREATE INDEX idx_adoption_applications_listing_id ON adoption_applications(listing_id);
CREATE INDEX idx_adoption_applications_customer_id ON adoption_applications(customer_id);
CREATE INDEX idx_adoption_applications_status ON adoption_applications(status);

COMMENT ON TABLE adoption_applications IS 'Adoption applications - replaces adoption:application:{id} KV keys';


-- ============================================================================
-- PET PROFILE PUBLISHING TABLES
-- ============================================================================
-- 
-- Tables for breeder profiles, pet listings, and adoption center profiles.
-- Note: Adoption listings already exist in 020_adoption_tables.sql
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- BREEDER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS breeder_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breeder_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    license_number TEXT,
    kci_registration TEXT,
    years_in_business INTEGER DEFAULT 0,
    specialized_breeds JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Location (JSONB)
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Contact (JSONB)
    contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Certifications (JSONB array)
    certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Gallery (JSONB array)
    gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    rating NUMERIC(3, 1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_sales INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    facilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_breeder_profiles_breeder_id ON breeder_profiles(breeder_id);
CREATE INDEX idx_breeder_profiles_vendor_id ON breeder_profiles(vendor_id);
CREATE INDEX idx_breeder_profiles_published ON breeder_profiles(is_published) WHERE is_published = true;
CREATE INDEX idx_breeder_profiles_verified ON breeder_profiles(is_verified) WHERE is_verified = true;

COMMENT ON TABLE breeder_profiles IS 'Breeder profiles - maps from breeder:profile:{breederId} KV keys';

-- ============================================================================
-- PET LISTINGS (For Sale by Breeders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pet_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id TEXT NOT NULL UNIQUE,
    breeder_id TEXT NOT NULL REFERENCES breeder_profiles(breeder_id) ON DELETE CASCADE,
    breeder_name TEXT NOT NULL,
    
    pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'bird', 'other')),
    breed TEXT NOT NULL,
    sub_breed TEXT,
    name TEXT,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    date_of_birth DATE NOT NULL,
    age_months INTEGER,
    age_display_text TEXT,
    color TEXT DEFAULT '',
    markings TEXT,
    
    price NUMERIC(10, 2) NOT NULL,
    negotiable BOOLEAN DEFAULT false,
    
    -- Lineage (JSONB)
    lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Health Information (JSONB)
    health JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Temperament (JSONB)
    temperament JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Registration (JSONB)
    registration JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Media (JSONB)
    media JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'reserved', 'sold')),
    ready_to_leave BOOLEAN DEFAULT true,
    ready_date DATE,
    
    -- Location (JSONB)
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Delivery Options (JSONB)
    delivery_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    view_count INTEGER DEFAULT 0,
    inquiry_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_pet_listings_listing_id ON pet_listings(listing_id);
CREATE INDEX idx_pet_listings_breeder_id ON pet_listings(breeder_id);
CREATE INDEX idx_pet_listings_pet_type ON pet_listings(pet_type);
CREATE INDEX idx_pet_listings_breed ON pet_listings(breed);
CREATE INDEX idx_pet_listings_published ON pet_listings(is_published) WHERE is_published = true;
CREATE INDEX idx_pet_listings_availability ON pet_listings(availability) WHERE availability = 'available';
CREATE INDEX idx_pet_listings_featured ON pet_listings(is_featured) WHERE is_featured = true;
CREATE INDEX idx_pet_listings_created_at ON pet_listings(created_at DESC);

COMMENT ON TABLE pet_listings IS 'Pet listings for sale - maps from pet:listing:{listingId} KV keys';

-- ============================================================================
-- ADOPTION CENTER PROFILES
-- ============================================================================
-- Note: Adoption centers are vendors, but they have extended profile data

CREATE TABLE IF NOT EXISTS adoption_center_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    center_name TEXT NOT NULL,
    registration_number TEXT,
    type TEXT NOT NULL CHECK (type IN ('shelter', 'rescue', 'ngo', 'government')),
    years_active INTEGER DEFAULT 0,
    
    -- Location (JSONB)
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Contact (JSONB)
    contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    capacity INTEGER DEFAULT 50,
    current_animals INTEGER DEFAULT 0,
    animal_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    services JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Adoption Process (JSONB)
    adoption_process JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    volunteer_program BOOLEAN DEFAULT false,
    donation_accepted BOOLEAN DEFAULT false,
    
    -- Gallery (JSONB array)
    gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Success Stories (JSONB array)
    success_stories JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    rating NUMERIC(3, 1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_adoptions INTEGER DEFAULT 0,
    
    is_verified BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_adoption_center_profiles_center_id ON adoption_center_profiles(center_id);
CREATE INDEX idx_adoption_center_profiles_vendor_id ON adoption_center_profiles(vendor_id);
CREATE INDEX idx_adoption_center_profiles_type ON adoption_center_profiles(type);
CREATE INDEX idx_adoption_center_profiles_published ON adoption_center_profiles(is_published) WHERE is_published = true;

COMMENT ON TABLE adoption_center_profiles IS 'Adoption center profiles - maps from adoption:center:{centerId} KV keys';

-- ============================================================================
-- PET INQUIRIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pet_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL REFERENCES pet_listings(listing_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed', 'declined')),
    
    responded_at TIMESTAMPTZ,
    responded_by TEXT,
    response_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_pet_inquiries_inquiry_id ON pet_inquiries(inquiry_id);
CREATE INDEX idx_pet_inquiries_listing_id ON pet_inquiries(listing_id);
CREATE INDEX idx_pet_inquiries_customer_id ON pet_inquiries(customer_id);
CREATE INDEX idx_pet_inquiries_status ON pet_inquiries(status);

COMMENT ON TABLE pet_inquiries IS 'Pet inquiries - maps from pet:inquiry:{inquiryId} KV keys';


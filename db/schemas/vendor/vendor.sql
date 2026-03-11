-- ============================================================================
-- VENDORS TABLE - SCHEMA
-- ============================================================================
-- Purpose: Stores vendor profiles and business information
-- Maps: vendor:{vendorId} KV keys
-- UI Source: DynamicVendorOnboardingForm, AddVendorModal
-- 
-- This table stores:
-- 1. Vendor business information (name, owner, contact)
-- 2. Business details (registration, GST, PAN)
-- 3. Location information (address, coordinates)
-- 4. Status and tier information
-- 5. Operational details (hours, capacity, specialization)
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity Link
    vendor_identity_id UUID REFERENCES vendor_identity(id) ON DELETE SET NULL,
    
    -- Contact Information
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    alternate_phone VARCHAR(20),
    
    -- Business Information
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    
    -- Business Details
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    category VARCHAR(100),
    experience_years INTEGER,
    registration_number VARCHAR(100),
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    
    -- Location
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    landmark TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    
    -- Status & Tier
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('new', 'onboarding', 'pending', 'approved', 'rejected', 'active', 'suspended', 'inactive')
    ),
    tier VARCHAR(20) DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
    commission_percentage NUMERIC(5, 2) DEFAULT 15.00,
    
    -- Operational Details
    operating_hours TEXT,
    capacity INTEGER,
    specialization TEXT,
    specializations JSONB DEFAULT '[]'::jsonb,
    
    -- Profile & Verification
    profile_image TEXT,
    is_verified BOOLEAN DEFAULT false,
    languages JSONB DEFAULT '["English", "Hindi"]'::jsonb,
    rating NUMERIC(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    completed_bookings_count INTEGER DEFAULT 0,
    
    -- Onboarding & Go Live
    onboarding_progress INTEGER DEFAULT 0 CHECK (onboarding_progress >= 0 AND onboarding_progress <= 100),
    go_live_at TIMESTAMPTZ,
    go_live_checklist JSONB DEFAULT '{}'::jsonb,
    
    -- Commission & Tier
    commission_tier_id UUID,
    commission_rate NUMERIC(5, 2) DEFAULT 15.00,
    
    -- Payment & UPI
    upi_id TEXT,
    upi_verified BOOLEAN DEFAULT false,
    upi_verified_at TIMESTAMPTZ,
    
    -- Home Service Settings
    home_service_enabled BOOLEAN DEFAULT false,
    home_service_operating_hours JSONB DEFAULT '{}'::jsonb,
    current_latitude NUMERIC(10, 8),
    current_longitude NUMERIC(11, 8),
    location_updated_at TIMESTAMPTZ,
    home_booking_settings JSONB DEFAULT '{"instantBookingEnabled": false, "advanceBookingDays": 30, "minimumNoticeMinutes": 60, "maxDailyHomeBookings": 5}'::jsonb,
    
    -- Service Settings
    service_radius NUMERIC(5, 2),
    emergency_contact JSONB,
    max_dogs_per_walk INTEGER,
    walk_durations TEXT[] DEFAULT ARRAY[]::TEXT[],
    other_config JSONB DEFAULT '{}'::jsonb,
    scheduling_policy JSONB DEFAULT '{}'::jsonb,
    
    -- E-commerce Settings
    fulfillment_type TEXT DEFAULT 'warmpawz' CHECK (fulfillment_type IN ('warmpawz', 'self', 'hybrid')),
    default_carrier TEXT,
    return_address JSONB,
    shipping_origin_pincode TEXT,
    processing_days INTEGER DEFAULT 1,
    is_returnable BOOLEAN DEFAULT true,
    return_window_days INTEGER DEFAULT 7,
    return_policy TEXT,
    
    -- Seller Status (E-commerce)
    seller_status TEXT DEFAULT 'not_applied' CHECK (seller_status IN ('not_applied', 'pending', 'approved', 'rejected')),
    seller_approved_at TIMESTAMPTZ,
    seller_approved_by UUID,
    seller_rejection_reason TEXT,
    
    -- Configuration Flags
    setup_completed BOOLEAN DEFAULT false,
    availability_configured BOOLEAN DEFAULT false,
    services_configured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    
    -- Metadata & Settings
    metadata JSONB DEFAULT '{}'::jsonb,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    user_id UUID,
    
    -- Financial Tracking
    total_earnings NUMERIC(10, 2) DEFAULT 0,
    pending_payout NUMERIC(10, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID, -- References admin users
    last_login_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_vendor_phone_format CHECK (phone ~ '^[0-9]{10,15}$'),
    CONSTRAINT chk_vendor_email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_vendor_commission CHECK (commission_percentage >= 0 AND commission_percentage <= 100)


    is_deleted BOOLEAN DEFAULT false,
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendors IS 'Vendor profiles - maps from vendor:{id} KV keys';
COMMENT ON COLUMN vendors.vendor_identity_id IS 'Reference to vendor_identity table for authentication and onboarding state';
COMMENT ON COLUMN vendors.phone IS 'Primary contact phone number - unique identifier';
COMMENT ON COLUMN vendors.business_name IS 'Business/center name from DynamicVendorOnboardingForm';
COMMENT ON COLUMN vendors.owner_name IS 'Owner name from DynamicVendorOnboardingForm';
COMMENT ON COLUMN vendors.role_id IS 'Vendor role from roles table (vet_clinic, groomer_solo, etc.)';
COMMENT ON COLUMN vendors.status IS 'Vendor status: new, onboarding, pending, approved, rejected, active, suspended, inactive';
COMMENT ON COLUMN vendors.tier IS 'Vendor tier: Bronze, Silver, Gold, Platinum';
COMMENT ON COLUMN vendors.commission_percentage IS 'Platform commission percentage (0-100)';
COMMENT ON COLUMN vendors.setup_completed IS 'Whether vendor has completed initial setup (services, availability, etc.)';
COMMENT ON COLUMN vendors.metadata IS 'Stores vacation mode, re-approval info, and other vendor settings (JSONB)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Partial unique index: phone must be unique ONLY among non-deleted rows
-- This allows the same phone number to be reused when old records are soft-deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_phone_unique_active
  ON vendors (phone)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors(email);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_role_id ON vendors(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_identity_id ON vendors(vendor_identity_id) WHERE vendor_identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendors_city_state ON vendors(city, state);
CREATE INDEX IF NOT EXISTS idx_vendors_pincode ON vendors(pincode);
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_metadata_gin ON vendors USING gin(metadata) WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors USING gist(point(longitude, latitude)) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_languages ON vendors USING gin(languages);
CREATE INDEX IF NOT EXISTS idx_vendors_is_verified ON vendors(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_vendors_specializations ON vendors USING gin(specializations);
CREATE INDEX IF NOT EXISTS idx_vendors_go_live_at ON vendors(go_live_at) WHERE go_live_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_upi_id ON vendors(upi_id) WHERE upi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating DESC) WHERE rating > 0;
CREATE INDEX IF NOT EXISTS idx_vendors_last_login_at ON vendors(last_login_at DESC) WHERE last_login_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_seller_status ON vendors(seller_status) WHERE seller_status != 'not_applied';
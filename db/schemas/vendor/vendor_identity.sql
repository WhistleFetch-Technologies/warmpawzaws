-- ============================================================================
-- VENDOR IDENTITY TABLE - SCHEMA
-- ============================================================================
-- Purpose: Manages vendor authentication, onboarding state, and identity
-- Maps: vendor_identity:{id} KV keys
-- UI Source: VendorOnboardingForm, DynamicVendorOnboardingForm
-- 
-- This table tracks:
-- 1. Vendor authentication (phone, email)
-- 2. Onboarding progress and status
-- 3. Role and vendor type selection
-- 4. Link to vendor profile (once activated)
-- 5. Staff member identities (user_type = 'staff')
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_identity (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Authentication & Contact
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    
    -- Role & Type Selection
    selected_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    vendor_type VARCHAR(50) CHECK (vendor_type IN ('solo', 'center', 'business')),
    user_type VARCHAR(20) DEFAULT 'vendor' CHECK (user_type IN ('vendor', 'staff', 'individual_provider')),
    
    -- Onboarding State
    onboarding_status VARCHAR(50) NOT NULL DEFAULT 'ROLE_PENDING' CHECK (
        onboarding_status IN (
            'INIT',
            'ROLE_PENDING',
            'FORM_PENDING',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'CLARIFICATION_REQUIRED',
            'ACTIVATED'
        )
    ),
    
    -- Relationships
    application_id UUID, -- References vendor_onboarding_applications(id) - FK added separately to avoid circular dependency
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    
    -- Identity Information
    full_name VARCHAR(255), -- For staff members or individual providers
    business_name VARCHAR(255), -- For business/center vendors
    
    -- Metadata & Flexible Storage
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_vendor_identity_phone_format CHECK (phone ~ '^[0-9]{10,15}$'),
    CONSTRAINT chk_vendor_identity_email_format CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')

      is_deleted BOOLEAN DEFAULT false,
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_identity IS 'Vendor identity and onboarding state - tracks authentication, role selection, and onboarding progress';
COMMENT ON COLUMN vendor_identity.phone IS 'Primary identifier - unique phone number (10-15 digits)';
COMMENT ON COLUMN vendor_identity.selected_role_id IS 'Selected role from roles table (vet_clinic, groomer_solo, etc.)';
COMMENT ON COLUMN vendor_identity.vendor_type IS 'Type of vendor: solo (individual), center (clinic/business), or business';
COMMENT ON COLUMN vendor_identity.user_type IS 'Type of user: vendor (main vendor account), staff (staff member), or individual_provider (solo provider)';
COMMENT ON COLUMN vendor_identity.onboarding_status IS 'Current onboarding state: INIT, ROLE_PENDING, FORM_PENDING, UNDER_REVIEW, APPROVED, REJECTED, CLARIFICATION_REQUIRED, ACTIVATED';
COMMENT ON COLUMN vendor_identity.vendor_id IS 'Reference to vendors table (set when vendor is activated)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Partial unique index: phone must be unique ONLY among non-deleted rows
-- This allows the same phone number to be reused when old records are soft-deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_identity_phone_unique_active
  ON vendor_identity (phone)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_vendor_identity_status ON vendor_identity(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_vendor_identity_vendor_id ON vendor_identity(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_identity_role_id ON vendor_identity(selected_role_id) WHERE selected_role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_identity_application_id ON vendor_identity(application_id) WHERE application_id IS NOT NULL;
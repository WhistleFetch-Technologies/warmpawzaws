-- ============================================================================
-- VENDOR ONBOARDING APPLICATIONS TABLE - SCHEMA
-- ============================================================================
-- Purpose: Stores vendor onboarding application submissions and review data
-- Maps: vendor_onboarding_application:{id} KV keys
-- UI Source: DynamicVendorOnboardingForm, VendorOnboardingReview
-- 
-- This table stores:
-- 1. Application form data (dynamic JSONB payload)
-- 2. Uploaded documents
-- 3. Application status and review workflow
-- 4. Admin review comments and decisions
-- 5. Lock status to prevent edits after submission
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_onboarding_applications (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    vendor_identity_id UUID NOT NULL REFERENCES vendor_identity(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    
    -- Application Type
    vendor_type VARCHAR(50) CHECK (vendor_type IN ('solo', 'center', 'business')),
    
    -- Application Data
    application_payload JSONB DEFAULT '{}'::jsonb,
    uploaded_documents JSONB DEFAULT '[]'::jsonb,
    form_version INTEGER DEFAULT 1,
    
    -- Status & Workflow
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN (
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'CLARIFICATION_REQUIRED',
            'ACTIVATED'
        )
    ),
    
    -- Submission Tracking
    submitted_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMPTZ,
    
    -- Review Information
    reviewed_by UUID, -- References admin users
    reviewed_at TIMESTAMPTZ,
    admin_comments TEXT,
    admin_notes TEXT,
    clarification_notes TEXT,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL


      is_deleted BOOLEAN DEFAULT false,
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_onboarding_applications IS 'Vendor onboarding application submissions - stores form data and review workflow';
COMMENT ON COLUMN vendor_onboarding_applications.vendor_identity_id IS 'Reference to vendor_identity table';
COMMENT ON COLUMN vendor_onboarding_applications.role_id IS 'Selected role for this application';
COMMENT ON COLUMN vendor_onboarding_applications.vendor_type IS 'Type of vendor: solo (individual), center (clinic/business), or business';
COMMENT ON COLUMN vendor_onboarding_applications.application_payload IS 'Dynamic form data stored as JSONB - contains all form fields';
COMMENT ON COLUMN vendor_onboarding_applications.uploaded_documents IS 'Array of uploaded document metadata (JSONB)';
COMMENT ON COLUMN vendor_onboarding_applications.form_version IS 'Version of the form used for this application';
COMMENT ON COLUMN vendor_onboarding_applications.status IS 'Application status: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CLARIFICATION_REQUIRED, ACTIVATED';
COMMENT ON COLUMN vendor_onboarding_applications.is_locked IS 'Prevents edits after submission - locked when status changes from DRAFT';
COMMENT ON COLUMN vendor_onboarding_applications.admin_comments IS 'General admin comments during review';
COMMENT ON COLUMN vendor_onboarding_applications.clarification_notes IS 'Specific notes requesting clarification from vendor';
COMMENT ON COLUMN vendor_onboarding_applications.rejection_reason IS 'Reason for rejection if application is rejected';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_voa_vendor_identity ON vendor_onboarding_applications(vendor_identity_id);
CREATE INDEX IF NOT EXISTS idx_voa_status ON vendor_onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_voa_role_id ON vendor_onboarding_applications(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voa_submitted_at ON vendor_onboarding_applications(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voa_reviewed_by ON vendor_onboarding_applications(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voa_is_locked ON vendor_onboarding_applications(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_voa_application_payload ON vendor_onboarding_applications USING gin(application_payload) WHERE application_payload != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_voa_created_at ON vendor_onboarding_applications(created_at DESC);

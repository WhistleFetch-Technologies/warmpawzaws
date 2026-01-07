-- ============================================================================
-- VENDOR ONBOARDING STATE MACHINE - COMPLETE IMPLEMENTATION
-- ============================================================================
-- Migration: 049 - Vendor Onboarding State Machine
-- Date: 2025-01-06
-- 
-- This migration implements a complete, database-driven vendor onboarding
-- flow with state machine, role-based dynamic forms, and admin approval workflow.
-- 
-- CRITICAL: All state transitions are persisted in DB, no UI-only flows
-- ============================================================================

-- ============================================================================
-- 1. VENDOR IDENTITY TABLE (OTP & AUTH)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    
    -- Onboarding State Machine
    onboarding_status TEXT NOT NULL DEFAULT 'INIT' CHECK (
        onboarding_status IN (
            'INIT',
            'ROLE_PENDING',
            'FORM_PENDING',
            'UNDER_REVIEW',
            'CLARIFICATION_REQUIRED',
            'APPROVED',
            'REJECTED',
            'ACTIVATED'
        )
    ),
    
    -- Selected Role & Type
    selected_role_id UUID REFERENCES roles(id),
    vendor_type TEXT CHECK (vendor_type IN ('solo', 'business')),
    
    -- Application Tracking
    application_id UUID, -- References vendor_onboarding_applications
    current_step TEXT, -- Current step in onboarding (e.g., 'profile', 'bank', 'services')
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_identity_phone ON vendor_identity(phone);
CREATE INDEX IF NOT EXISTS idx_vendor_identity_status ON vendor_identity(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_vendor_identity_role ON vendor_identity(selected_role_id);

COMMENT ON TABLE vendor_identity IS 'Vendor authentication and onboarding state - tracks OTP verification and onboarding progress';
COMMENT ON COLUMN vendor_identity.onboarding_status IS 'State machine status: INIT → ROLE_PENDING → FORM_PENDING → UNDER_REVIEW → APPROVED/REJECTED → ACTIVATED';
COMMENT ON COLUMN vendor_identity.vendor_type IS 'Selected vendor type: solo or business (enforced by role config)';

-- ============================================================================
-- 2. VENDOR ONBOARDING APPLICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_onboarding_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_identity_id UUID NOT NULL REFERENCES vendor_identity(id) ON DELETE CASCADE,
    
    -- Role & Type
    role_id UUID NOT NULL REFERENCES roles(id),
    vendor_type TEXT NOT NULL CHECK (vendor_type IN ('solo', 'business')),
    
    -- Form Data (Dynamic JSON Schema)
    application_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    form_version TEXT, -- Version of form schema used
    
    -- Documents
    uploaded_documents JSONB DEFAULT '[]'::jsonb, -- Array of {type, url, name, size}
    
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'APPROVED', 'REJECTED')
    ),
    
    -- Admin Actions
    reviewed_by UUID, -- Admin user ID
    reviewed_at TIMESTAMPTZ,
    admin_comments TEXT, -- Comments from admin (for clarification/rejection)
    rejection_reason TEXT, -- Specific reason if rejected
    
    -- Locking (prevent edits after submission)
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMPTZ,
    
    -- Metadata
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_applications_identity ON vendor_onboarding_applications(vendor_identity_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON vendor_onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_role ON vendor_onboarding_applications(role_id);

COMMENT ON TABLE vendor_onboarding_applications IS 'Vendor application submissions - stores dynamic form data and admin review status';
COMMENT ON COLUMN vendor_onboarding_applications.application_payload IS 'Dynamic form data based on role + vendor_type schema';
COMMENT ON COLUMN vendor_onboarding_applications.uploaded_documents IS 'Array of uploaded documents: [{type, url, name, size, verified}]';

-- ============================================================================
-- 3. ONBOARDING STATE TRANSITIONS (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_onboarding_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_identity_id UUID NOT NULL REFERENCES vendor_identity(id) ON DELETE CASCADE,
    
    -- Transition Details
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    transition_reason TEXT, -- 'user_action', 'admin_approval', 'auto_progression', etc.
    
    -- Actor
    triggered_by UUID, -- User ID (vendor or admin)
    triggered_by_type TEXT CHECK (triggered_by_type IN ('vendor', 'admin', 'system')),
    
    -- Context
    context_data JSONB DEFAULT '{}'::jsonb, -- Additional context (form data, comments, etc.)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_transitions_identity ON vendor_onboarding_transitions(vendor_identity_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transitions_status ON vendor_onboarding_transitions(to_status, created_at DESC);

COMMENT ON TABLE vendor_onboarding_transitions IS 'Audit trail of all onboarding state transitions';

-- ============================================================================
-- 4. POST-ACTIVATION SETUP TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_setup_completion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Completion Flags
    profile_completed BOOLEAN DEFAULT false,
    bank_account_completed BOOLEAN DEFAULT false,
    business_hours_completed BOOLEAN DEFAULT false,
    staff_management_completed BOOLEAN DEFAULT false,
    services_configured BOOLEAN DEFAULT false,
    
    -- Completion Timestamps
    profile_completed_at TIMESTAMPTZ,
    bank_account_completed_at TIMESTAMPTZ,
    business_hours_completed_at TIMESTAMPTZ,
    staff_management_completed_at TIMESTAMPTZ,
    services_configured_at TIMESTAMPTZ,
    
    -- Go-Live Status
    is_go_live_ready BOOLEAN DEFAULT false,
    go_live_ready_at TIMESTAMPTZ,
    go_live_at TIMESTAMPTZ,
    
    -- Metadata
    completion_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_setup_vendor ON vendor_setup_completion(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_setup_go_live ON vendor_setup_completion(is_go_live_ready);

COMMENT ON TABLE vendor_setup_completion IS 'Tracks post-activation setup completion - gates go-live';

-- ============================================================================
-- 5. UPDATE VENDORS TABLE
-- ============================================================================

-- Add onboarding_status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE vendors ADD COLUMN onboarding_status TEXT CHECK (
        onboarding_status IN (
            'INIT',
            'ROLE_PENDING',
            'FORM_PENDING',
            'UNDER_REVIEW',
            'CLARIFICATION_REQUIRED',
            'APPROVED',
            'REJECTED',
            'ACTIVATED'
        )
    );
  END IF;
END $$;

-- Add vendor_identity_id foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'vendor_identity_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN vendor_identity_id UUID REFERENCES vendor_identity(id);
  END IF;
END $$;

-- Add vendor_type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'vendor_type'
  ) THEN
    ALTER TABLE vendors ADD COLUMN vendor_type TEXT CHECK (vendor_type IN ('solo', 'business'));
  END IF;
END $$;

-- ============================================================================
-- 6. ENHANCE ROLES TABLE FOR ONBOARDING
-- ============================================================================

-- Ensure roles.config has onboarding_form_schema support
-- (Already exists from migration 018, but add comment)
COMMENT ON COLUMN roles.config IS 'Role configuration JSONB: {vendorTypes: ["solo"|"business"], capabilities: [], serviceCatalogMapping: [], onboardingFormSchema: {solo: {...}, business: {...}}}';

-- ============================================================================
-- 7. STATE MACHINE GUARD FUNCTIONS
-- ============================================================================

-- Function to validate state transition
CREATE OR REPLACE FUNCTION validate_onboarding_transition(
    p_from_status TEXT,
    p_to_status TEXT,
    p_vendor_type TEXT DEFAULT NULL,
    p_role_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Valid transitions (state machine rules)
    CASE p_from_status
        WHEN 'INIT' THEN
            RETURN p_to_status IN ('ROLE_PENDING');
        WHEN 'ROLE_PENDING' THEN
            RETURN p_to_status IN ('FORM_PENDING', 'INIT'); -- Can go back to INIT if role selection fails
        WHEN 'FORM_PENDING' THEN
            RETURN p_to_status IN ('UNDER_REVIEW', 'ROLE_PENDING'); -- Can go back to role selection
        WHEN 'UNDER_REVIEW' THEN
            RETURN p_to_status IN ('APPROVED', 'CLARIFICATION_REQUIRED', 'REJECTED');
        WHEN 'CLARIFICATION_REQUIRED' THEN
            RETURN p_to_status IN ('UNDER_REVIEW', 'REJECTED'); -- Can resubmit or get rejected
        WHEN 'APPROVED' THEN
            RETURN p_to_status IN ('ACTIVATED');
        WHEN 'REJECTED' THEN
            RETURN p_to_status IN ('ROLE_PENDING', 'INIT'); -- Can start over
        WHEN 'ACTIVATED' THEN
            RETURN FALSE; -- Terminal state (no transitions out)
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to transition state (with audit trail)
CREATE OR REPLACE FUNCTION transition_onboarding_status(
    p_vendor_identity_id UUID,
    p_to_status TEXT,
    p_triggered_by UUID DEFAULT NULL,
    p_triggered_by_type TEXT DEFAULT 'system',
    p_reason TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
    v_is_valid BOOLEAN;
BEGIN
    -- Get current status
    SELECT onboarding_status INTO v_current_status
    FROM vendor_identity
    WHERE id = p_vendor_identity_id;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Vendor identity not found';
    END IF;
    
    -- Validate transition
    SELECT validate_onboarding_transition(v_current_status, p_to_status) INTO v_is_valid;
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid state transition from % to %', v_current_status, p_to_status;
    END IF;
    
    -- Update status
    UPDATE vendor_identity
    SET 
        onboarding_status = p_to_status,
        updated_at = NOW(),
        last_activity_at = NOW()
    WHERE id = p_vendor_identity_id;
    
    -- Create audit trail
    INSERT INTO vendor_onboarding_transitions (
        vendor_identity_id,
        from_status,
        to_status,
        transition_reason,
        triggered_by,
        triggered_by_type,
        context_data
    ) VALUES (
        p_vendor_identity_id,
        v_current_status,
        p_to_status,
        p_reason,
        p_triggered_by,
        p_triggered_by_type,
        p_context
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to get onboarding form schema for role + vendor_type
CREATE OR REPLACE FUNCTION get_onboarding_form_schema(
    p_role_id UUID,
    p_vendor_type TEXT
) RETURNS JSONB AS $$
DECLARE
    v_role_config JSONB;
    v_schema JSONB;
BEGIN
    -- Get role config
    SELECT config INTO v_role_config
    FROM roles
    WHERE id = p_role_id AND is_active = true;
    
    IF v_role_config IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Extract form schema for vendor type
    v_schema := v_role_config->'onboardingFormSchema'->p_vendor_type;
    
    RETURN v_schema;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if vendor can proceed to go-live
CREATE OR REPLACE FUNCTION is_vendor_go_live_ready(p_vendor_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_setup vendor_setup_completion%ROWTYPE;
BEGIN
    SELECT * INTO v_setup
    FROM vendor_setup_completion
    WHERE vendor_id = p_vendor_id;
    
    IF v_setup IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- All required steps must be completed
    RETURN (
        v_setup.profile_completed = true AND
        v_setup.bank_account_completed = true AND
        v_setup.business_hours_completed = true AND
        v_setup.services_configured = true
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendor_applications_identity_status 
ON vendor_onboarding_applications(vendor_identity_id, status);

CREATE INDEX IF NOT EXISTS idx_vendor_identity_status_role 
ON vendor_identity(onboarding_status, selected_role_id) 
WHERE onboarding_status IN ('ROLE_PENDING', 'FORM_PENDING', 'UNDER_REVIEW');

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION validate_onboarding_transition IS 'Validates state machine transitions - enforces business rules';
COMMENT ON FUNCTION transition_onboarding_status IS 'Safely transitions onboarding status with audit trail';
COMMENT ON FUNCTION get_onboarding_form_schema IS 'Returns dynamic form schema for role + vendor_type combination';
COMMENT ON FUNCTION is_vendor_go_live_ready IS 'Checks if vendor has completed all required setup steps for go-live';


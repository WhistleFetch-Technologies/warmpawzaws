-- ============================================================================
-- MIGRATION 504: KYC VERIFICATION SCHEMA
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Create tables for KYC verification tracking and vendor declarations
-- 
-- Tables:
--   - vendor_kyc_verifications: Tracks Aadhaar, PAN, GST verification status
--   - vendor_declarations: Stores vendor consent declarations
-- ============================================================================

-- ============================================================================
-- 1. VENDOR KYC VERIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Aadhaar Verification
    aadhaar_number_masked TEXT, -- Last 4 digits only for display (e.g., "XXXX XXXX 1234")
    aadhaar_verified BOOLEAN DEFAULT false,
    aadhaar_verified_at TIMESTAMPTZ,
    aadhaar_verification_id TEXT, -- Reference ID from verification provider
    aadhaar_name TEXT, -- Name as per Aadhaar
    aadhaar_verification_response JSONB, -- Store full response for audit
    
    -- PAN Verification
    pan_number TEXT, -- PAN number (ABCDE1234F format)
    pan_verified BOOLEAN DEFAULT false,
    pan_verified_at TIMESTAMPTZ,
    pan_status TEXT CHECK (pan_status IN ('active', 'inactive', 'unknown')),
    pan_name TEXT, -- Name as per PAN
    pan_name_match_score DECIMAL(5,2), -- Name match percentage (0-100)
    pan_verification_response JSONB, -- Store full response for audit
    
    -- GST Verification
    gstin TEXT, -- GSTIN number
    gstin_verified BOOLEAN DEFAULT false,
    gstin_verified_at TIMESTAMPTZ,
    gstin_status TEXT CHECK (gstin_status IN ('Active', 'Cancelled', 'Suspended', 'unknown')),
    gstin_legal_name TEXT, -- Legal name as per GST
    gstin_trade_name TEXT, -- Trade name as per GST
    gstin_state_code TEXT, -- State code from GSTIN
    gstin_verification_response JSONB, -- Store full response for audit
    
    -- Police Verification (Manual Process)
    police_verification_status TEXT DEFAULT 'not_submitted' 
        CHECK (police_verification_status IN ('not_submitted', 'submitted', 'pending', 'verified', 'rejected', 'expired')),
    police_verification_doc_url TEXT,
    police_verification_expiry DATE,
    police_verification_notes TEXT,
    police_verified_by UUID, -- Admin user who verified (no FK to allow flexibility)
    police_verified_at TIMESTAMPTZ,
    
    -- Professional Registration Verification (VCI, State Council, etc.)
    professional_reg_number TEXT,
    professional_reg_type TEXT, -- 'vci', 'state_council', 'pharmacy_council', etc.
    professional_reg_verified BOOLEAN DEFAULT false,
    professional_reg_verified_at TIMESTAMPTZ,
    professional_reg_expiry DATE,
    professional_reg_notes TEXT,
    
    -- AWBI Registration (for breeders/NGOs)
    awbi_registration TEXT,
    awbi_verified BOOLEAN DEFAULT false,
    awbi_verified_at TIMESTAMPTZ,
    awbi_expiry DATE,
    
    -- Overall KYC Status
    kyc_status TEXT DEFAULT 'pending' 
        CHECK (kyc_status IN ('pending', 'partial', 'complete', 'expired', 'rejected', 'under_review')),
    kyc_score INTEGER DEFAULT 0 CHECK (kyc_score >= 0 AND kyc_score <= 100),
    kyc_completed_at TIMESTAMPTZ,
    kyc_reviewed_by UUID, -- Admin user who reviewed (no FK to allow flexibility)
    kyc_review_notes TEXT,
    
    -- Soft Block Status
    is_soft_blocked BOOLEAN DEFAULT false,
    soft_block_reason TEXT,
    soft_block_fields TEXT[], -- Array of field IDs that triggered soft block
    
    -- Annual Revalidation (for breeders)
    requires_annual_revalidation BOOLEAN DEFAULT false,
    last_revalidation_date DATE,
    next_revalidation_due DATE,
    revalidation_reminder_sent BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per vendor
    UNIQUE(vendor_id)
);

-- Indexes for vendor_kyc_verifications
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_vendor_id ON vendor_kyc_verifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_status ON vendor_kyc_verifications(kyc_status);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_aadhaar_verified ON vendor_kyc_verifications(aadhaar_verified);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_pan_verified ON vendor_kyc_verifications(pan_verified);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_gstin_verified ON vendor_kyc_verifications(gstin_verified);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_police_status ON vendor_kyc_verifications(police_verification_status);
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_soft_blocked ON vendor_kyc_verifications(is_soft_blocked) WHERE is_soft_blocked = true;
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_revalidation_due ON vendor_kyc_verifications(next_revalidation_due) WHERE requires_annual_revalidation = true;

-- ============================================================================
-- 2. VENDOR DECLARATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Declaration Details
    declaration_type TEXT NOT NULL,
    declaration_text TEXT NOT NULL,
    declaration_version TEXT DEFAULT '1.0',
    
    -- Acceptance
    accepted BOOLEAN NOT NULL DEFAULT false,
    accepted_at TIMESTAMPTZ,
    
    -- Audit Trail
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one declaration of each type per vendor
    UNIQUE(vendor_id, declaration_type)
);

-- Declaration type check constraint
ALTER TABLE vendor_declarations DROP CONSTRAINT IF EXISTS vendor_declarations_type_check;
ALTER TABLE vendor_declarations ADD CONSTRAINT vendor_declarations_type_check 
    CHECK (declaration_type IN (
        'no_criminal_record',
        'non_medical_advice',
        'no_clinical_claims',
        'breeding_limits',
        'no_third_party_sales',
        'annual_revalidation_consent',
        'premises_hygiene',
        'vet_tie_up',
        'environmental_compliance',
        'experience_accuracy',
        'adoption_policy_compliance',
        'platform_terms',
        'privacy_policy',
        'data_processing_consent'
    ));

-- Indexes for vendor_declarations
CREATE INDEX IF NOT EXISTS idx_vendor_declarations_vendor_id ON vendor_declarations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_declarations_type ON vendor_declarations(declaration_type);
CREATE INDEX IF NOT EXISTS idx_vendor_declarations_accepted ON vendor_declarations(accepted);

-- ============================================================================
-- 3. KYC VERIFICATION AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS kyc_verification_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Verification Details
    verification_type TEXT NOT NULL CHECK (verification_type IN ('aadhaar', 'pan', 'gst', 'police', 'professional', 'awbi')),
    action TEXT NOT NULL CHECK (action IN ('initiated', 'otp_sent', 'otp_verified', 'verified', 'failed', 'expired', 'manual_review', 'approved', 'rejected')),
    
    -- Request/Response
    request_data JSONB, -- Sanitized request (no sensitive data)
    response_data JSONB, -- Sanitized response
    
    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_code TEXT,
    
    -- Provider Info
    provider TEXT, -- 'sandbox', 'signzy', 'idfy', 'karza', 'manual'
    provider_reference_id TEXT,
    
    -- Audit
    performed_by UUID, -- NULL for automated, user ID for manual
    ip_address TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for kyc_verification_audit_log
CREATE INDEX IF NOT EXISTS idx_kyc_audit_vendor_id ON kyc_verification_audit_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_type ON kyc_verification_audit_log(verification_type);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_action ON kyc_verification_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_created ON kyc_verification_audit_log(created_at);

-- ============================================================================
-- 4. UPDATE TRIGGER FOR vendor_kyc_verifications
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vendor_kyc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Calculate KYC score based on verified fields
    NEW.kyc_score = 0;
    
    IF NEW.aadhaar_verified THEN
        NEW.kyc_score = NEW.kyc_score + 25;
    END IF;
    
    IF NEW.pan_verified THEN
        NEW.kyc_score = NEW.kyc_score + 25;
    END IF;
    
    IF NEW.gstin_verified THEN
        NEW.kyc_score = NEW.kyc_score + 15;
    END IF;
    
    IF NEW.police_verification_status = 'verified' THEN
        NEW.kyc_score = NEW.kyc_score + 20;
    END IF;
    
    IF NEW.professional_reg_verified THEN
        NEW.kyc_score = NEW.kyc_score + 15;
    END IF;
    
    -- Update overall KYC status based on score
    IF NEW.kyc_score >= 80 THEN
        NEW.kyc_status = 'complete';
        IF NEW.kyc_completed_at IS NULL THEN
            NEW.kyc_completed_at = NOW();
        END IF;
    ELSIF NEW.kyc_score >= 50 THEN
        NEW.kyc_status = 'partial';
    ELSE
        NEW.kyc_status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_kyc_updated_at ON vendor_kyc_verifications;
CREATE TRIGGER trigger_update_vendor_kyc_updated_at
    BEFORE UPDATE ON vendor_kyc_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_kyc_updated_at();

-- ============================================================================
-- 5. UPDATE TRIGGER FOR vendor_declarations
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vendor_declarations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set accepted_at if accepting
    IF NEW.accepted = true AND (OLD.accepted IS NULL OR OLD.accepted = false) THEN
        NEW.accepted_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_declarations_updated_at ON vendor_declarations;
CREATE TRIGGER trigger_update_vendor_declarations_updated_at
    BEFORE UPDATE ON vendor_declarations
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_declarations_updated_at();

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get vendor KYC status summary
CREATE OR REPLACE FUNCTION get_vendor_kyc_summary(p_vendor_id UUID)
RETURNS TABLE (
    kyc_status TEXT,
    kyc_score INTEGER,
    aadhaar_verified BOOLEAN,
    pan_verified BOOLEAN,
    gstin_verified BOOLEAN,
    police_status TEXT,
    is_soft_blocked BOOLEAN,
    missing_mandatory_fields TEXT[],
    pending_verifications TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.kyc_status,
        k.kyc_score,
        k.aadhaar_verified,
        k.pan_verified,
        k.gstin_verified,
        k.police_verification_status,
        k.is_soft_blocked,
        k.soft_block_fields,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT k.aadhaar_verified THEN 'aadhaar' END,
            CASE WHEN NOT k.pan_verified THEN 'pan' END,
            CASE WHEN NOT k.gstin_verified AND k.gstin IS NOT NULL THEN 'gst' END,
            CASE WHEN k.police_verification_status NOT IN ('verified', 'not_submitted') THEN 'police' END
        ], NULL)
    FROM vendor_kyc_verifications k
    WHERE k.vendor_id = p_vendor_id;
    
    -- If no record exists, return default values
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            'pending'::TEXT,
            0::INTEGER,
            false::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            'not_submitted'::TEXT,
            false::BOOLEAN,
            ARRAY['aadhaar', 'pan']::TEXT[],
            ARRAY['aadhaar', 'pan']::TEXT[];
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if vendor can be activated (all mandatory KYC complete)
CREATE OR REPLACE FUNCTION can_activate_vendor(p_vendor_id UUID, p_role_name TEXT)
RETURNS TABLE (
    can_activate BOOLEAN,
    blocking_fields TEXT[],
    soft_block_fields TEXT[]
) AS $$
DECLARE
    v_kyc RECORD;
    v_blocking TEXT[] := '{}';
    v_soft_block TEXT[] := '{}';
BEGIN
    SELECT * INTO v_kyc FROM vendor_kyc_verifications WHERE vendor_id = p_vendor_id;
    
    -- Check Aadhaar (mandatory for all)
    IF v_kyc IS NULL OR NOT v_kyc.aadhaar_verified THEN
        v_blocking := array_append(v_blocking, 'aadhaar');
    END IF;
    
    -- Check PAN (mandatory for all)
    IF v_kyc IS NULL OR NOT v_kyc.pan_verified THEN
        v_blocking := array_append(v_blocking, 'pan');
    END IF;
    
    -- Check Police Verification for doorstep services
    IF p_role_name IN ('pet_walker', 'pet_groomer', 'pet_trainer', 'pet_sitter') THEN
        IF v_kyc IS NULL OR v_kyc.police_verification_status != 'verified' THEN
            v_soft_block := array_append(v_soft_block, 'police_verification');
        END IF;
    END IF;
    
    -- Check VCI for veterinarians
    IF p_role_name IN ('veterinarian', 'veterinary_clinic') THEN
        IF v_kyc IS NULL OR NOT v_kyc.professional_reg_verified THEN
            v_blocking := array_append(v_blocking, 'vci_registration');
        END IF;
    END IF;
    
    -- Check AWBI for breeders
    IF p_role_name = 'pet_breeder' THEN
        IF v_kyc IS NULL OR NOT v_kyc.awbi_verified THEN
            v_blocking := array_append(v_blocking, 'awbi_registration');
        END IF;
    END IF;
    
    RETURN QUERY SELECT 
        array_length(v_blocking, 1) IS NULL OR array_length(v_blocking, 1) = 0,
        v_blocking,
        v_soft_block;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_kyc_verifications IS 'Tracks KYC verification status for vendors including Aadhaar, PAN, GST, and professional registrations';
COMMENT ON TABLE vendor_declarations IS 'Stores vendor consent declarations required for different service types';
COMMENT ON TABLE kyc_verification_audit_log IS 'Audit trail for all KYC verification attempts';

COMMENT ON COLUMN vendor_kyc_verifications.aadhaar_number_masked IS 'Masked Aadhaar number showing only last 4 digits for display purposes';
COMMENT ON COLUMN vendor_kyc_verifications.kyc_score IS 'Calculated score (0-100) based on verified fields';
COMMENT ON COLUMN vendor_kyc_verifications.soft_block_fields IS 'Array of field IDs that triggered soft block on vendor profile';
COMMENT ON COLUMN vendor_kyc_verifications.requires_annual_revalidation IS 'True for roles like breeders that need annual revalidation';

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ KYC Verification Schema Migration Complete';
    RAISE NOTICE '   - Created vendor_kyc_verifications table';
    RAISE NOTICE '   - Created vendor_declarations table';
    RAISE NOTICE '   - Created kyc_verification_audit_log table';
    RAISE NOTICE '   - Created helper functions and triggers';
END $$;

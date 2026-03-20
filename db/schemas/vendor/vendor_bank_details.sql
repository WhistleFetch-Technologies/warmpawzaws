-- ============================================================================
-- VENDOR_BANK_DETAILS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_bank_details (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_bank_details ADD CONSTRAINT vendor_bank_details_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_bank_details ADD CONSTRAINT vendor_bank_details_vendor_id_key UNIQUE (vendor_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_bank_details_pkey ON public.vendor_bank_details USING btree (id);
CREATE UNIQUE INDEX vendor_bank_details_vendor_id_key ON public.vendor_bank_details USING btree (vendor_id);
CREATE INDEX idx_vendor_bank_details_verified ON public.vendor_bank_details USING btree (is_verified) WHERE is_verified = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_bank_details IS 'Maps from DynamicVendorOnboardingForm banking fields';
COMMENT ON COLUMN vendor_bank_details.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_bank_details.bank_name IS 'From formData.bankName';
COMMENT ON COLUMN vendor_bank_details.account_number IS 'From formData.accountNumber';
COMMENT ON COLUMN vendor_bank_details.ifsc_code IS 'From formData.ifscCode';
COMMENT ON COLUMN vendor_bank_details.account_holder_name IS 'From formData.accountHolderName';
COMMENT ON COLUMN vendor_bank_details.is_verified IS 'Whether bank details have been verified';
COMMENT ON COLUMN vendor_bank_details.verified_at IS 'Timestamp when bank details were verified';

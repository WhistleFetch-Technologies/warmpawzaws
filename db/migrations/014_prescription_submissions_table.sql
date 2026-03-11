-- ============================================================================
-- MIGRATION 014: Prescription Submissions Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create prescription_submissions table for pharmacy verification flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS prescription_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id TEXT NOT NULL UNIQUE, -- Human-readable submission ID
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pharmacy_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Prescription details
    prescription_url TEXT NOT NULL,
    prescription_type TEXT NOT NULL CHECK (prescription_type IN ('image', 'pdf')),
    notes TEXT,
    
    -- Pet information
    pet_id UUID REFERENCES pets(id),
    pet_name TEXT,
    
    -- Customer information (snapshot at submission time)
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    -- Pharmacy information (snapshot at submission time)
    pharmacy_name TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN (
        'pending_verification',
        'verified',
        'rejected'
    )),
    
    -- Verification details
    verification_notes TEXT,
    verified_by UUID REFERENCES staff(id),
    verified_at TIMESTAMPTZ,
    
    -- Medicines (filled after verification)
    medicines JSONB DEFAULT '[]'::JSONB,
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescription_submissions_customer ON prescription_submissions(customer_id);
CREATE INDEX idx_prescription_submissions_pharmacy ON prescription_submissions(pharmacy_vendor_id);
CREATE INDEX idx_prescription_submissions_status ON prescription_submissions(status);
CREATE INDEX idx_prescription_submissions_submission_id ON prescription_submissions(submission_id);
CREATE INDEX idx_prescription_submissions_submitted_at ON prescription_submissions(submitted_at DESC);

COMMENT ON TABLE prescription_submissions IS 'Stores prescription submissions for pharmacy verification, replacing KV store usage';
COMMENT ON COLUMN prescription_submissions.submission_id IS 'Human-readable submission ID (e.g., PRESC-SUB-1234567890-ABC123)';


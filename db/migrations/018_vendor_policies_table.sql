-- ============================================================================
-- MIGRATION 018: Vendor Policies Table
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create table for vendor insurance/coverage policies, replacing KV store usage
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL, -- Human-readable policy ID
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Policy details
    policy_name TEXT NOT NULL,
    policy_type TEXT NOT NULL, -- e.g., 'insurance', 'coverage', 'warranty'
    premium NUMERIC(10, 2) NOT NULL,
    coverage_amount NUMERIC(10, 2) NOT NULL,
    deductible NUMERIC(10, 2) DEFAULT 0,
    waiting_period_days INTEGER DEFAULT 30,
    
    -- Validity
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    
    -- Metadata
    policy_data JSONB, -- Additional policy-specific data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_policies_vendor ON vendor_policies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_policies_status ON vendor_policies(status);
CREATE INDEX IF NOT EXISTS idx_vendor_policies_policy_id ON vendor_policies(policy_id);

COMMENT ON TABLE vendor_policies IS 'Stores vendor insurance/coverage policies, replacing KV store usage (policy:{vendorId}:* keys)';


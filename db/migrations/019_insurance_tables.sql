-- ============================================================================
-- MIGRATION 019: Insurance Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create tables for insurance plans, policies, and claims (replaces KV store)
-- ============================================================================

-- ============================================================================
-- INSURANCE PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL UNIQUE,
    plan_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('accident_only', 'time_limited', 'maximum_benefit', 'lifetime')),
    coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
    monthly_premium NUMERIC(10, 2) NOT NULL,
    annual_premium NUMERIC(10, 2) NOT NULL,
    deductible NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_cover_age INTEGER,
    min_cover_age INTEGER DEFAULT 0,
    waiting_period INTEGER DEFAULT 0, -- in days
    features TEXT[] DEFAULT '{}',
    exclusions TEXT[] DEFAULT '{}',
    claim_process TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_plans_plan_id ON insurance_plans(plan_id);
CREATE INDEX idx_insurance_plans_type ON insurance_plans(plan_type);
CREATE INDEX idx_insurance_plans_active ON insurance_plans(is_active) WHERE is_active = true;

COMMENT ON TABLE insurance_plans IS 'Insurance plans - replaces insurance:plan:{id} KV keys';

-- ============================================================================
-- INSURANCE POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE,
    policy_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES insurance_plans(plan_id) ON DELETE RESTRICT,
    plan_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_documents' CHECK (status IN ('pending_documents', 'under_review', 'active', 'expired', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    premium_amount NUMERIC(10, 2) NOT NULL,
    coverage_amount NUMERIC(10, 2) NOT NULL,
    deductible NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly', 'annual')),
    next_payment_date DATE,
    documents JSONB DEFAULT '[]'::jsonb,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ
);

CREATE INDEX idx_insurance_policies_policy_id ON insurance_policies(policy_id);
CREATE INDEX idx_insurance_policies_customer_id ON insurance_policies(customer_id);
CREATE INDEX idx_insurance_policies_pet_id ON insurance_policies(pet_id);
CREATE INDEX idx_insurance_policies_plan_id ON insurance_policies(plan_id);
CREATE INDEX idx_insurance_policies_status ON insurance_policies(status);

COMMENT ON TABLE insurance_policies IS 'Insurance policies - replaces insurance:policy:{id} KV keys';

-- ============================================================================
-- INSURANCE CLAIMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL UNIQUE,
    policy_id TEXT NOT NULL REFERENCES insurance_policies(policy_id) ON DELETE CASCADE,
    policy_number TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('accident', 'illness', 'surgery', 'dental', 'vaccination')),
    incident_date DATE NOT NULL,
    claim_amount NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    veterinarian_name TEXT,
    clinic_name TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'paid')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    approved_amount NUMERIC(10, 2),
    rejection_reason TEXT,
    payment_date DATE,
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_claims_claim_id ON insurance_claims(claim_id);
CREATE INDEX idx_insurance_claims_policy_id ON insurance_claims(policy_id);
CREATE INDEX idx_insurance_claims_customer_id ON insurance_claims(customer_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims(status);

COMMENT ON TABLE insurance_claims IS 'Insurance claims - replaces insurance:claim:{id} KV keys';


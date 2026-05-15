-- ============================================================================
-- MIGRATION 618: Pet insurance tables — align RDS with Lambda (vendor web)
-- ============================================================================
-- Date: 2026-03-26
--
-- Pet insurance vendors need exactly THREE domain tables (plus existing core):
--   1. insurance_plans     — vendor-authored products (must include vendor_id)
--   2. insurance_policies  — customer policies (FK plan_id → insurance_plans.id)
--   3. insurance_claims    — claims against policies (FK policy_id → insurance_policies.id)
--
-- Prerequisites (not created here): public.vendors, public.customers, public.pets
--
-- This migration is idempotent: adds missing columns and syncs legacy names
-- (e.g. name → plan_name, monthly_premium ↔ premium_monthly). It does NOT drop
-- tables. If your DB was created by 019 (TEXT plan_id) and differs radically,
-- you may need a one-off data migration before relying on UUID plan_id paths.
--
-- Run (example):
--   psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/618_pet_insurance_lambda_rds_alignment.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) insurance_plans — Lambda expects vendor_id, plan_name, premium_monthly,
--    coverage_amount, coverage_details (JSONB), etc. (see capability-tables.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL DEFAULT 'Plan',
    description TEXT,
    coverage_type VARCHAR(100),
    plan_type TEXT,
    coverage_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    premium_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
    premium_yearly NUMERIC(10, 2),
    coverage_details JSONB DEFAULT '{}'::jsonb,
    exclusions JSONB DEFAULT '[]'::jsonb,
    waiting_period_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns on older tables (019 / 030 shapes)
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS coverage_type VARCHAR(100);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS coverage_amount NUMERIC(12, 2);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS premium_monthly NUMERIC(10, 2);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS premium_yearly NUMERIC(10, 2);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS coverage_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS exclusions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS waiting_period_days INTEGER DEFAULT 30;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Public browse API still filters on monthly_premium in some Lambda versions
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS monthly_premium NUMERIC(10, 2);

-- Legacy 030: column "name" → plan_name
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_plans' AND column_name = 'name'
    ) THEN
        UPDATE insurance_plans SET plan_name = COALESCE(plan_name, name) WHERE plan_name IS NULL OR plan_name = '';
    END IF;
END $$;

-- Keep premium_monthly and monthly_premium in sync when one side is populated
UPDATE insurance_plans
SET premium_monthly = COALESCE(premium_monthly, monthly_premium, 0)
WHERE premium_monthly IS NULL AND monthly_premium IS NOT NULL;

UPDATE insurance_plans
SET monthly_premium = COALESCE(monthly_premium, premium_monthly, 0)
WHERE monthly_premium IS NULL AND premium_monthly IS NOT NULL;

-- Default plan_name when still null (NOT NULL safety for older rows)
UPDATE insurance_plans SET plan_name = 'Plan' WHERE plan_name IS NULL OR TRIM(plan_name) = '';

CREATE INDEX IF NOT EXISTS idx_insurance_plans_vendor_id ON insurance_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_active ON insurance_plans(is_active) WHERE is_active = true;

COMMENT ON TABLE insurance_plans IS 'Pet insurance plan catalog per vendor (Lambda /vendor/:id/insurance/plans)';

-- ---------------------------------------------------------------------------
-- 2) insurance_policies — customer purchases; Lambda uses UUID plan_id
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number TEXT UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending_documents',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    premium_amount NUMERIC(10, 2) NOT NULL,
    coverage_amount NUMERIC(12, 2),
    deductible NUMERIC(10, 2) DEFAULT 0,
    payment_frequency TEXT DEFAULT 'monthly',
    next_payment_date DATE,
    documents JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy / partial tables may omit these; indexes require columns to exist
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS policy_number TEXT;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE CASCADE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES insurance_plans(id) ON DELETE RESTRICT;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_documents';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS premium_amount NUMERIC(10, 2);
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS payment_id UUID;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS coverage_amount NUMERIC(12, 2);
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS deductible NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS next_payment_date DATE;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer ON insurance_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_pet ON insurance_policies(pet_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_plan ON insurance_policies(plan_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);

COMMENT ON TABLE insurance_policies IS 'Issued pet insurance policies (Lambda customer + vendor policy endpoints)';

-- ---------------------------------------------------------------------------
-- 3) insurance_claims — Lambda insert uses claim_amount, policy UUID, etc.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    policy_number TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    claim_type TEXT NOT NULL,
    incident_date DATE NOT NULL,
    claim_amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    veterinarian_name TEXT,
    clinic_name TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS policy_number TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS claim_type TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS incident_date DATE;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS claim_amount NUMERIC(10, 2);
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS veterinarian_name TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS clinic_name TEXT;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 030-style claimed_amount → claim_amount for Lambda
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_claims' AND column_name = 'claimed_amount'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_claims' AND column_name = 'claim_amount'
    ) THEN
        UPDATE insurance_claims SET claim_amount = COALESCE(claim_amount, claimed_amount, 0) WHERE claim_amount IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_claims' AND column_name = 'claimed_amount'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_claims' AND column_name = 'claim_amount'
    ) THEN
        ALTER TABLE insurance_claims ADD COLUMN claim_amount NUMERIC(10, 2);
        UPDATE insurance_claims SET claim_amount = claimed_amount WHERE claim_amount IS NULL;
        RAISE NOTICE 'Added claim_amount from claimed_amount';
    END IF;
END $$;

-- Allow optional description on insert (Lambda may omit)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'insurance_claims' AND column_name = 'description'
    ) THEN
        ALTER TABLE insurance_claims ALTER COLUMN description DROP NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);

COMMENT ON TABLE insurance_claims IS 'Pet insurance claims (Lambda /insurance/claims and vendor claims)';

-- ============================================================================
-- End 618
-- ============================================================================

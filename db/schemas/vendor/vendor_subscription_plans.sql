-- ============================================================================
-- VENDOR_SUBSCRIPTION_PLANS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_subscription_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL,
    vendor_id UUID NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_subscription_plans ADD CONSTRAINT vendor_subscription_plans_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_subscription_plans ADD CONSTRAINT vendor_subscription_plans_plan_id_key UNIQUE (plan_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_subscription_plans ADD CONSTRAINT vendor_subscription_plans_interval_check CHECK (interval IN ('monthly', 'yearly'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_subscription_plans_pkey ON public.vendor_subscription_plans USING btree (id);
CREATE UNIQUE INDEX vendor_subscription_plans_plan_id_key ON public.vendor_subscription_plans USING btree (plan_id);
CREATE INDEX idx_vendor_subscription_plans_vendor ON public.vendor_subscription_plans USING btree (vendor_id);
CREATE INDEX idx_vendor_subscription_plans_active ON public.vendor_subscription_plans USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_subscription_plans IS 'Vendor-created subscription plans (e.g., Premium Grooming Membership)';
COMMENT ON COLUMN vendor_subscription_plans.plan_id IS 'Human-readable plan ID (unique)';
COMMENT ON COLUMN vendor_subscription_plans.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_subscription_plans.name IS 'Plan name';
COMMENT ON COLUMN vendor_subscription_plans.price IS 'Plan price';
COMMENT ON COLUMN vendor_subscription_plans.interval IS 'Billing interval: monthly, yearly';
COMMENT ON COLUMN vendor_subscription_plans.features IS 'Plan features (JSONB array)';
COMMENT ON COLUMN vendor_subscription_plans.is_active IS 'Whether plan is active';

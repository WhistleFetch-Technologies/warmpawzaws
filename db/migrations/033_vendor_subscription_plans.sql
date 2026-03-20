-- ============================================================================
-- MIGRATION 033: Vendor Subscription Plans Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create tables for vendor-created subscription plans and customer subscriptions
-- ============================================================================

-- Vendor Subscription Plans
-- Maps: plan:{planId} KV keys
CREATE TABLE IF NOT EXISTS vendor_subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL UNIQUE, -- Human-readable plan ID
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_subscription_plans_vendor ON vendor_subscription_plans(vendor_id);
CREATE INDEX idx_vendor_subscription_plans_plan_id ON vendor_subscription_plans(plan_id);
CREATE INDEX idx_vendor_subscription_plans_active ON vendor_subscription_plans(is_active) WHERE is_active = true;

COMMENT ON TABLE vendor_subscription_plans IS 'Vendor-created subscription plans (e.g., Premium Grooming Membership)';

-- Customer Subscriptions to Vendor Plans
-- Maps: sub:{subId} KV keys
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT NOT NULL UNIQUE, -- Human-readable subscription ID
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES vendor_subscription_plans(plan_id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_billing_date TIMESTAMPTZ,
    payment_method_id TEXT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX idx_customer_subscriptions_plan ON customer_subscriptions(plan_id);
CREATE INDEX idx_customer_subscriptions_vendor ON customer_subscriptions(vendor_id);
CREATE INDEX idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX idx_customer_subscriptions_next_billing ON customer_subscriptions(next_billing_date) WHERE status = 'active';

COMMENT ON TABLE customer_subscriptions IS 'Customer subscriptions to vendor-created plans';


-- ============================================================================
-- MIGRATION 306: Add Financial & Policy Fields
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add discount_source, subscription payment, and policy acceptance fields
-- Phase: Phase 6 - Financial Flows
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- ============================================================================

-- Add discount_source to payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'discount_source'
    ) THEN
        ALTER TABLE payments ADD COLUMN discount_source VARCHAR(20) CHECK (discount_source IN ('vendor', 'platform'));
        COMMENT ON COLUMN payments.discount_source IS 'Source of discount: vendor or platform';
    END IF;
END $$;

-- Add subscription_id to payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN subscription_id UUID;
        COMMENT ON COLUMN payments.subscription_id IS 'Subscription ID for subscription-based payments';
    END IF;
END $$;

-- Add policy fields to bookings table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'policy_accepted'
    ) THEN
        ALTER TABLE bookings ADD COLUMN policy_accepted BOOLEAN DEFAULT false;
        COMMENT ON COLUMN bookings.policy_accepted IS 'Whether customer accepted booking policy';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'policy_version'
    ) THEN
        ALTER TABLE bookings ADD COLUMN policy_version VARCHAR(50);
        COMMENT ON COLUMN bookings.policy_version IS 'Version of policy accepted';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'policy_accepted_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN policy_accepted_at TIMESTAMPTZ;
        COMMENT ON COLUMN bookings.policy_accepted_at IS 'Timestamp when policy was accepted';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'customer_signature'
    ) THEN
        ALTER TABLE bookings ADD COLUMN customer_signature TEXT;
        COMMENT ON COLUMN bookings.customer_signature IS 'Customer signature for policy acceptance';
    END IF;
END $$;

-- Create platform_promotions table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL,
    max_discount_amount NUMERIC(10,2),
    min_order_value NUMERIC(10,2),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_promotions IS 'Platform-wide promotions (distinct from vendor promotions)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_discount_source ON payments(discount_source) WHERE discount_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_policy_accepted ON bookings(policy_accepted) WHERE policy_accepted = true;
CREATE INDEX IF NOT EXISTS idx_platform_promotions_code ON platform_promotions(code);
CREATE INDEX IF NOT EXISTS idx_platform_promotions_active ON platform_promotions(is_active) WHERE is_active = true;

COMMENT ON TABLE payments IS 'Payments with discount source and subscription support';
COMMENT ON TABLE bookings IS 'Bookings with policy acceptance tracking';

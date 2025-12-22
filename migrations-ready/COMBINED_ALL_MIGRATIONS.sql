-- ============================================================================
-- COMBINED FINANCIAL MIGRATIONS
-- Copy this entire file and paste into Supabase SQL Editor
-- This applies both migrations 008 and 009 at once
-- ============================================================================

-- ============================================================================
-- MIGRATION 008: Complete Financial Flows - SQL Only
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: 
-- 1. GST Configuration (role + service style combination)
-- 2. Vendor Tier System with Commission Rates
-- 3. Tier Upgrade Payments with Split Payment Options
-- 4. Enhanced Payment, Refund, Settlement tables
-- 5. All fixes for financial flow issues
-- ============================================================================

-- ============================================================================
-- 1. GST CONFIGURATION (Role + Service Style Combination)
-- ============================================================================

-- GST Rules (replaces platform:gst_rules KV)
CREATE TABLE IF NOT EXISTS gst_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    
    -- Conditions (role + service style combination)
    role_id UUID REFERENCES roles(id),
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele', 'hybrid')),
    category TEXT,
    min_amount NUMERIC(10, 2),
    max_amount NUMERIC(10, 2),
    customer_state TEXT,
    vendor_state TEXT,
    
    -- GST Configuration
    gst_type TEXT NOT NULL CHECK (gst_type IN ('percentage', 'fixed')) DEFAULT 'percentage',
    gst_rate NUMERIC(5, 2) NOT NULL CHECK (gst_rate >= 0 AND gst_rate <= 100),
    cgst_percentage NUMERIC(5, 2),
    sgst_percentage NUMERIC(5, 2),
    igst_percentage NUMERIC(5, 2),
    
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique priority for enabled rules
    CONSTRAINT gst_rules_priority_unique UNIQUE NULLS NOT DISTINCT (priority) WHERE enabled = true
);

COMMENT ON TABLE gst_rules IS 'GST configuration by role and service style combination';
COMMENT ON COLUMN gst_rules.role_id IS 'Vendor role (NULL = applies to all roles)';
COMMENT ON COLUMN gst_rules.service_style IS 'Service style (NULL = applies to all styles)';

-- Indexes for GST rules
CREATE INDEX IF NOT EXISTS idx_gst_rules_role_service ON gst_rules(role_id, service_style) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_gst_rules_priority ON gst_rules(priority) WHERE enabled = true;

-- ============================================================================
-- 2. VENDOR TIER SYSTEM
-- ============================================================================

-- Vendor Tiers (replaces payment:tiers KV)
CREATE TABLE IF NOT EXISTS vendor_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL UNIQUE,
    tier_level INTEGER NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    
    -- Commission Configuration
    commission_rate NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    payout_period_days INTEGER DEFAULT 7 CHECK (payout_period_days >= 0),
    
    -- Pricing
    monthly_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    yearly_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    six_month_cost NUMERIC(10, 2),
    six_month_discount_percentage NUMERIC(5, 2) DEFAULT 0,
    twelve_month_cost NUMERIC(10, 2),
    twelve_month_discount_percentage NUMERIC(5, 2) DEFAULT 0,
    
    -- Payment Options
    allow_split_payment BOOLEAN DEFAULT false,
    split_payment_installments INTEGER DEFAULT 3 CHECK (split_payment_installments BETWEEN 2 AND 4),
    split_payment_interval_days INTEGER DEFAULT 30,
    
    -- Features
    features JSONB DEFAULT '[]',
    applicable_roles UUID[] DEFAULT '{}', -- Array of role IDs (empty = all roles)
    
    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_free_tier BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Only one default tier allowed
    CONSTRAINT vendor_tiers_single_default CHECK (
        (is_default = true AND is_free_tier = false) OR is_default = false
    )
);

COMMENT ON TABLE vendor_tiers IS 'Vendor subscription tiers with commission rates';
COMMENT ON COLUMN vendor_tiers.commission_rate IS 'Platform commission percentage for this tier';
COMMENT ON COLUMN vendor_tiers.is_free_tier IS 'True for free tier (Bronze), false for paid tiers';

-- Vendor Tier Subscriptions
CREATE TABLE IF NOT EXISTS vendor_tier_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
    
    -- Subscription Details
    subscription_type TEXT NOT NULL CHECK (subscription_type IN ('monthly', 'six_month', 'twelve_month', 'yearly')),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('upfront', 'split')),
    total_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    final_amount NUMERIC(10, 2) NOT NULL,
    
    -- Split Payment Details
    split_installments INTEGER,
    split_interval_days INTEGER,
    next_payment_date DATE,
    next_payment_amount NUMERIC(10, 2),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_payment')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Payment Tracking
    payment_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendor_tier_subscriptions IS 'Vendor tier subscriptions with payment tracking';

-- Tier Upgrade Payments
CREATE TABLE IF NOT EXISTS tier_upgrade_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES vendor_tier_subscriptions(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
    
    -- Payment Details
    payment_type TEXT NOT NULL CHECK (payment_type IN ('upfront', 'split_installment')),
    installment_number INTEGER, -- NULL for upfront, 1-4 for split
    amount NUMERIC(10, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    
    -- Razorpay Integration
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    
    -- Metadata
    payment_date TIMESTAMPTZ,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tier_upgrade_payments IS 'Individual tier upgrade payments (upfront or split installments)';

-- Update vendors table to track current tier
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vendors' AND column_name = 'current_tier_id') THEN
        ALTER TABLE vendors ADD COLUMN current_tier_id UUID REFERENCES vendor_tiers(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vendors' AND column_name = 'tier_subscription_id') THEN
        ALTER TABLE vendors ADD COLUMN tier_subscription_id UUID REFERENCES vendor_tier_subscriptions(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vendors' AND column_name = 'tier_upgraded_at') THEN
        ALTER TABLE vendors ADD COLUMN tier_upgraded_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_tier_subscriptions_vendor ON vendor_tier_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tier_subscriptions_status ON vendor_tier_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_payments_vendor ON tier_upgrade_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_payments_subscription ON tier_upgrade_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_payments_status ON tier_upgrade_payments(payment_status);

-- ============================================================================
-- 3. ENHANCED PAYMENT TABLE (Store Commission Rate)
-- ============================================================================

-- Add commission tracking to payments table
DO $$
BEGIN
    -- Commission details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'commission_rate') THEN
        ALTER TABLE payments ADD COLUMN commission_rate NUMERIC(5, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'platform_commission') THEN
        ALTER TABLE payments ADD COLUMN platform_commission NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'vendor_amount') THEN
        ALTER TABLE payments ADD COLUMN vendor_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'tier_at_payment') THEN
        ALTER TABLE payments ADD COLUMN tier_at_payment TEXT;
    END IF;
    
    -- GST details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'gst_amount') THEN
        ALTER TABLE payments ADD COLUMN gst_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'cgst_amount') THEN
        ALTER TABLE payments ADD COLUMN cgst_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'sgst_amount') THEN
        ALTER TABLE payments ADD COLUMN sgst_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'igst_amount') THEN
        ALTER TABLE payments ADD COLUMN igst_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'gst_rule_id') THEN
        ALTER TABLE payments ADD COLUMN gst_rule_id UUID REFERENCES gst_rules(id);
    END IF;
    
    -- Wallet tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'wallet_amount_used') THEN
        ALTER TABLE payments ADD COLUMN wallet_amount_used NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    -- Price validation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'price_validation') THEN
        ALTER TABLE payments ADD COLUMN price_validation JSONB;
    END IF;
END $$;

COMMENT ON COLUMN payments.commission_rate IS 'Commission rate at time of payment (stored for consistency)';
COMMENT ON COLUMN payments.tier_at_payment IS 'Vendor tier at time of payment';
COMMENT ON COLUMN payments.gst_rule_id IS 'GST rule applied to this payment';

-- ============================================================================
-- 4. ENHANCED REFUND TABLE (Track Commission Reversal)
-- ============================================================================

DO $$
BEGIN
    -- Commission reversal tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'commission_reversed') THEN
        ALTER TABLE refunds ADD COLUMN commission_reversed NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'vendor_amount_reversed') THEN
        ALTER TABLE refunds ADD COLUMN vendor_amount_reversed NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'is_partial') THEN
        ALTER TABLE refunds ADD COLUMN is_partial BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'cumulative_refund_amount') THEN
        ALTER TABLE refunds ADD COLUMN cumulative_refund_amount NUMERIC(10, 2);
    END IF;
    
    -- Refund method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' AND column_name = 'refund_method') THEN
        ALTER TABLE refunds ADD COLUMN refund_method TEXT CHECK (refund_method IN ('wallet', 'original', 'bank_transfer'));
    END IF;
END $$;

-- ============================================================================
-- 5. ENHANCED SETTLEMENT TABLE (Idempotency & Refund Tracking)
-- ============================================================================

DO $$
BEGIN
    -- Settlement idempotency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settlements' AND column_name = 'settlement_key') THEN
        ALTER TABLE settlements ADD COLUMN settlement_key TEXT UNIQUE;
    END IF;
    
    -- Refund exclusion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settlements' AND column_name = 'excluded_payment_ids') THEN
        ALTER TABLE settlements ADD COLUMN excluded_payment_ids UUID[] DEFAULT '{}';
    END IF;
    
    -- Commission details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settlements' AND column_name = 'commission_rate_used') THEN
        ALTER TABLE settlements ADD COLUMN commission_rate_used NUMERIC(5, 2);
    END IF;
END $$;

COMMENT ON COLUMN settlements.settlement_key IS 'Unique key for idempotency (vendor_id:period_start:period_end)';
COMMENT ON COLUMN settlements.excluded_payment_ids IS 'Payment IDs excluded from settlement (refunded payments)';

-- Settlement Booking Mapping (for idempotency)
CREATE TABLE IF NOT EXISTS settlement_booking_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(settlement_id, booking_id),
    UNIQUE(booking_id) -- One booking can only be settled once
);

COMMENT ON TABLE settlement_booking_mappings IS 'Maps bookings to settlements for idempotency';

CREATE INDEX IF NOT EXISTS idx_settlement_booking_mappings_settlement ON settlement_booking_mappings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_booking_mappings_booking ON settlement_booking_mappings(booking_id);

-- ============================================================================
-- 6. ENHANCED WALLET TABLE (Atomic Operations Support)
-- ============================================================================

DO $$
BEGIN
    -- Version for optimistic locking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_wallets' AND column_name = 'version') THEN
        ALTER TABLE customer_wallets ADD COLUMN version INTEGER DEFAULT 0;
    END IF;
    
    -- Total earned/spent tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_wallets' AND column_name = 'total_earned') THEN
        ALTER TABLE customer_wallets ADD COLUMN total_earned NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_wallets' AND column_name = 'total_spent') THEN
        ALTER TABLE customer_wallets ADD COLUMN total_spent NUMERIC(10, 2) DEFAULT 0;
    END IF;
END $$;

-- Wallet transaction lock table (for atomic operations)
CREATE TABLE IF NOT EXISTS wallet_transaction_locks (
    wallet_id UUID NOT NULL PRIMARY KEY REFERENCES customer_wallets(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    transaction_id UUID NOT NULL
);

COMMENT ON TABLE wallet_transaction_locks IS 'Locks for wallet transactions to prevent race conditions';

-- ============================================================================
-- 7. PLATFORM REVENUE TRACKING (For Commission Reversal)
-- ============================================================================

-- Platform Revenue by Month (replaces platform:revenue KV)
CREATE TABLE IF NOT EXISTS platform_revenue_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_month DATE NOT NULL UNIQUE, -- First day of month
    total_revenue NUMERIC(12, 2) DEFAULT 0,
    commission_revenue NUMERIC(12, 2) DEFAULT 0,
    transaction_fees NUMERIC(12, 2) DEFAULT 0,
    refund_reversals NUMERIC(12, 2) DEFAULT 0, -- Negative for reversals
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_revenue_monthly IS 'Monthly platform revenue tracking with commission reversals';

CREATE INDEX IF NOT EXISTS idx_platform_revenue_monthly_month ON platform_revenue_monthly(revenue_month);

-- ============================================================================
-- 8. COUPON USAGE TRACKING (Prevent Double Application)
-- ============================================================================

-- Coupon Usage (replaces coupons:usage:* KV)
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_id UUID REFERENCES orders(id),
    booking_id UUID REFERENCES bookings(id),
    order_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate usage
    UNIQUE(coupon_id, order_id) WHERE order_id IS NOT NULL,
    UNIQUE(coupon_id, booking_id) WHERE booking_id IS NOT NULL
);

COMMENT ON TABLE coupon_usage IS 'Tracks coupon usage to prevent double application';

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_customer ON coupon_usage(customer_id);

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_commission_rate ON payments(commission_rate);
CREATE INDEX IF NOT EXISTS idx_payments_tier_at_payment ON payments(tier_at_payment);
CREATE INDEX IF NOT EXISTS idx_payments_gst_rule ON payments(gst_rule_id);
CREATE INDEX IF NOT EXISTS idx_refunds_commission_reversed ON refunds(commission_reversed);
CREATE INDEX IF NOT EXISTS idx_settlements_settlement_key ON settlements(settlement_key);
CREATE INDEX IF NOT EXISTS idx_vendors_current_tier ON vendors(current_tier_id);

-- ============================================================================
-- 10. DEFAULT DATA
-- ============================================================================

-- Insert default free tier (Bronze)
INSERT INTO vendor_tiers (
    tier_name, tier_level, display_name, description,
    commission_rate, payout_period_days,
    monthly_cost, yearly_cost,
    is_default, is_active, is_free_tier
) VALUES (
    'bronze', 1, 'Bronze Tier', 'Free tier with standard commission',
    15.00, 7,
    0, 0,
    true, true, true
) ON CONFLICT (tier_name) DO NOTHING;

-- Insert default GST rule (18% for all)
INSERT INTO gst_rules (
    rule_name, enabled, priority,
    gst_type, gst_rate,
    description
) VALUES (
    'Default GST Rule', true, 999,
    'percentage', 18.00,
    'Default 18% GST for all services'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF MIGRATION 008
-- ============================================================================


-- ============================================================================
-- END OF MIGRATION 008
-- ============================================================================

-- ============================================================================
-- MIGRATION 009: Financial RPC Functions
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Database functions for financial operations
-- ============================================================================

-- Function: Update vendor earnings
CREATE OR REPLACE FUNCTION update_vendor_earnings(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_commission NUMERIC
)
RETURNS VOID AS $$
BEGIN
  -- Update vendor pending payout and total earnings
  UPDATE vendors
  SET 
    pending_payout = COALESCE(pending_payout, 0) + p_amount,
    total_earnings = COALESCE(total_earnings, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reverse vendor earnings (for refunds)
CREATE OR REPLACE FUNCTION reverse_vendor_earnings(
  p_vendor_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE vendors
  SET 
    pending_payout = GREATEST(COALESCE(pending_payout, 0) - p_amount, 0),
    total_earnings = GREATEST(COALESCE(total_earnings, 0) - p_amount, 0),
    updated_at = NOW()
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reverse platform commission (for refunds)
CREATE OR REPLACE FUNCTION reverse_platform_commission(
  p_month DATE,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO platform_revenue_monthly (
    revenue_month,
    commission_revenue,
    refund_reversals,
    updated_at
  )
  VALUES (
    p_month,
    -p_amount,
    -p_amount,
    NOW()
  )
  ON CONFLICT (revenue_month) DO UPDATE
  SET 
    commission_revenue = platform_revenue_monthly.commission_revenue - p_amount,
    refund_reversals = platform_revenue_monthly.refund_reversals - p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Check coupon usage (prevent double application)
CREATE OR REPLACE FUNCTION check_coupon_usage(
  p_coupon_id UUID,
  p_order_id UUID DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM coupon_usage
    WHERE coupon_id = p_coupon_id AND order_id = p_order_id;
    
    RETURN v_count = 0;
  ELSIF p_booking_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM coupon_usage
    WHERE coupon_id = p_coupon_id AND booking_id = p_booking_id;
    
    RETURN v_count = 0;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function: Get vendor tier commission rate
CREATE OR REPLACE FUNCTION get_vendor_commission_rate(p_vendor_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_commission_rate NUMERIC;
BEGIN
  SELECT vt.commission_rate INTO v_commission_rate
  FROM vendors v
  LEFT JOIN vendor_tiers vt ON v.current_tier_id = vt.id
  WHERE v.id = p_vendor_id
    AND (vt.is_active = true OR vt.id IS NULL);
  
  -- Default to 15% if no tier found
  RETURN COALESCE(v_commission_rate, 15.00);
END;
$$ LANGUAGE plpgsql;

-- Function: Create settlement with idempotency
CREATE OR REPLACE FUNCTION create_settlement(
  p_vendor_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_payment_ids UUID[],
  p_total_amount NUMERIC,
  p_commission_amount NUMERIC,
  p_net_amount NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_settlement_key TEXT;
  v_settlement_id UUID;
  v_existing_id UUID;
BEGIN
  -- Create unique settlement key for idempotency
  v_settlement_key := p_vendor_id::TEXT || ':' || p_period_start::TEXT || ':' || p_period_end::TEXT;
  
  -- Check if settlement already exists
  SELECT id INTO v_existing_id
  FROM settlements
  WHERE settlement_key = v_settlement_key;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id; -- Return existing settlement
  END IF;
  
  -- Create new settlement
  INSERT INTO settlements (
    vendor_id,
    settlement_period_start,
    settlement_period_end,
    payment_ids,
    total_amount,
    commission_amount,
    net_amount,
    settlement_status,
    settlement_key
  )
  VALUES (
    p_vendor_id,
    p_period_start,
    p_period_end,
    p_payment_ids,
    p_total_amount,
    p_commission_amount,
    p_net_amount,
    'pending',
    v_settlement_key
  )
  RETURNING id INTO v_settlement_id;
  
  -- Create settlement booking mappings for idempotency
  INSERT INTO settlement_booking_mappings (settlement_id, booking_id, payment_id)
  SELECT 
    v_settlement_id,
    b.id,
    p.id
  FROM payments p
  LEFT JOIN bookings b ON p.booking_id = b.id
  WHERE p.id = ANY(p_payment_ids)
  ON CONFLICT (booking_id) DO NOTHING; -- Prevent double settlement
  
  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;


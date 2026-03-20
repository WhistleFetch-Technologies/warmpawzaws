-- ============================================================================
-- MIGRATION 008: Vendor Tiers Table Only
-- ============================================================================
-- Date: 2026-01-12
-- Purpose: Create vendor_tiers table for POST /admin/tiers endpoint
-- ============================================================================

-- Vendor Tiers
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
    applicable_roles UUID[] DEFAULT '{}',
    
    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_free_tier BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendor_tiers IS 'Vendor subscription tiers with commission rates';
COMMENT ON COLUMN vendor_tiers.commission_rate IS 'Platform commission percentage for this tier';
COMMENT ON COLUMN vendor_tiers.is_free_tier IS 'True for free tier (Bronze), false for paid tiers';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_tiers_active ON vendor_tiers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendor_tiers_level ON vendor_tiers(tier_level);

-- ============================================================================
-- MIGRATION 029: Tier Upgrade Deductions from Settlements
-- ============================================================================
-- Date: 2026-01-27
-- Purpose: Track tier upgrade costs that need to be recovered from settlements
-- ============================================================================

-- Table to track tier upgrade costs that need to be deducted from settlements
CREATE TABLE IF NOT EXISTS tier_upgrade_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES vendor_tier_subscriptions(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
    
    -- Deduction Configuration
    total_amount NUMERIC(10, 2) NOT NULL,
    recovery_installments INTEGER NOT NULL DEFAULT 2, -- Number of payouts to split recovery
    amount_per_installment NUMERIC(10, 2) NOT NULL,
    
    -- Recovery Tracking
    amount_recovered NUMERIC(10, 2) NOT NULL DEFAULT 0,
    amount_remaining NUMERIC(10, 2) NOT NULL,
    installments_completed INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE tier_upgrade_deductions IS 'Tracks tier upgrade costs to be recovered from vendor settlements';
COMMENT ON COLUMN tier_upgrade_deductions.recovery_installments IS 'Number of payouts to split the tier upgrade cost (default 2)';

-- Table to track individual deduction transactions linked to settlements
CREATE TABLE IF NOT EXISTS tier_deduction_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_id UUID NOT NULL REFERENCES tier_upgrade_deductions(id) ON DELETE CASCADE,
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Transaction Details
    installment_number INTEGER NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    settlement_gross_amount NUMERIC(10, 2) NOT NULL, -- Original settlement amount before deduction
    settlement_net_amount NUMERIC(10, 2) NOT NULL, -- Amount after deduction
    
    -- Metadata
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tier_deduction_transactions IS 'Individual tier deduction transactions linked to settlements';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_vendor ON tier_upgrade_deductions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_status ON tier_upgrade_deductions(status);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_pending ON tier_upgrade_deductions(vendor_id, status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_tier_deduction_transactions_deduction ON tier_deduction_transactions(deduction_id);
CREATE INDEX IF NOT EXISTS idx_tier_deduction_transactions_settlement ON tier_deduction_transactions(settlement_id);

-- Add column to settlements table for detailed breakup
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settlements' AND column_name = 'settlement_breakup') THEN
        ALTER TABLE settlements ADD COLUMN settlement_breakup JSONB DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settlements' AND column_name = 'tier_deduction_amount') THEN
        ALTER TABLE settlements ADD COLUMN tier_deduction_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
END $$;

COMMENT ON COLUMN settlements.settlement_breakup IS 'Detailed breakup of settlement calculation with explanations';
COMMENT ON COLUMN settlements.tier_deduction_amount IS 'Amount deducted for tier upgrade recovery';

-- Add columns to vendor_tier_subscriptions for settlement recovery option
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vendor_tier_subscriptions' AND column_name = 'payment_method') THEN
        ALTER TABLE vendor_tier_subscriptions ADD COLUMN payment_method TEXT DEFAULT 'upfront' 
            CHECK (payment_method IN ('upfront', 'settlement_deduction'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vendor_tier_subscriptions' AND column_name = 'settlement_deduction_installments') THEN
        ALTER TABLE vendor_tier_subscriptions ADD COLUMN settlement_deduction_installments INTEGER DEFAULT 2;
    END IF;
END $$;

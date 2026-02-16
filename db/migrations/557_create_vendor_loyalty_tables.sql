-- ============================================================================
-- MIGRATION 557: Create Vendor Loyalty Points Tables
-- ============================================================================
-- Date: 2026-02-16
-- Purpose: Create separate tables for vendor loyalty points (separate from customer loyalty)
-- ============================================================================

-- Vendor Loyalty Points
CREATE TABLE IF NOT EXISTS vendor_loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    lifetime_points_earned INTEGER DEFAULT 0,
    lifetime_points_redeemed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Loyalty Transactions
CREATE TABLE IF NOT EXISTS vendor_loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points INTEGER NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Wallets
CREATE TABLE IF NOT EXISTS vendor_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Wallet Transactions
CREATE TABLE IF NOT EXISTS vendor_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES vendor_wallets(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout')),
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_loyalty_points_vendor ON vendor_loyalty_points(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_loyalty_transactions_vendor ON vendor_loyalty_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_loyalty_transactions_reference ON vendor_loyalty_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_loyalty_transactions_created ON vendor_loyalty_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_wallets_vendor ON vendor_wallets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_wallet ON vendor_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_vendor ON vendor_wallet_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_reference ON vendor_wallet_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_created ON vendor_wallet_transactions(created_at DESC);

-- Comments
COMMENT ON TABLE vendor_loyalty_points IS 'Vendor loyalty points balance and lifetime stats';
COMMENT ON TABLE vendor_loyalty_transactions IS 'Vendor loyalty points transaction history';
COMMENT ON TABLE vendor_wallets IS 'Vendor wallet balances (points converted to rupees)';
COMMENT ON TABLE vendor_wallet_transactions IS 'Vendor wallet transaction history';

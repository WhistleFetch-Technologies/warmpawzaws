-- ============================================================================
-- 623: Vendor wallets + transaction history (loyalty vendor payouts, wallet API)
-- ============================================================================
-- Mirrors customer_wallets / wallet_transactions pattern (012_wallet_tables).
-- App: loyalty-points-service.ts, wallet.ts (getOrCreateVendorWallet, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_wallets_vendor_id ON vendor_wallets(vendor_id);

CREATE TABLE IF NOT EXISTS vendor_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES vendor_wallets(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout')),
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_vendor_id ON vendor_wallet_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_wallet_id ON vendor_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wallet_transactions_created ON vendor_wallet_transactions(created_at DESC);

COMMENT ON TABLE vendor_wallets IS 'Vendor INR wallet; loyalty points convert to balance (100 pts = 1 INR)';
COMMENT ON TABLE vendor_wallet_transactions IS 'Vendor wallet ledger (credits/debits); source e.g. loyalty_points';

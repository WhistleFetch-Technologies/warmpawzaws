-- ============================================================================
-- MIGRATION 028: Vendor Earnings and Payouts Tables
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create vendor_earnings and payouts tables for financial tracking
-- Migration: KV to SQL - Payout Processing
-- ============================================================================

-- Vendor Earnings Table (track earnings per booking)
CREATE TABLE IF NOT EXISTS vendor_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  settlement_id UUID REFERENCES settlements(id),
  payout_id UUID REFERENCES payouts(id),
  amount NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'paid_out', 'cancelled')),
  realized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_out_at TIMESTAMPTZ
);

COMMENT ON TABLE vendor_earnings IS 'Vendor earnings per booking - replaces earnings:{id} KV keys';
COMMENT ON COLUMN vendor_earnings.amount IS 'Vendor earnings amount (after commission)';
COMMENT ON COLUMN vendor_earnings.commission_amount IS 'Platform commission amount';
COMMENT ON COLUMN vendor_earnings.total_amount IS 'Total booking amount';
COMMENT ON COLUMN vendor_earnings.commission_rate IS 'Commission rate percentage';

-- Payout Policies Table
CREATE TABLE IF NOT EXISTS payout_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  hold_period_days INTEGER NOT NULL DEFAULT 7,
  auto_payout BOOLEAN NOT NULL DEFAULT false,
  min_payout_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  payout_period TEXT NOT NULL DEFAULT 'weekly' CHECK (payout_period IN ('daily', 'weekly', 'biweekly', 'monthly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payout_policies IS 'Payout configuration policies - replaces admin:payout:policies KV key';

-- Payouts Table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  razorpay_payout_id TEXT,
  bank_account_id UUID,
  settlement_ids UUID[] NOT NULL DEFAULT '{}',
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payouts IS 'Vendor payouts - replaces payout:{id} KV keys';
COMMENT ON COLUMN payouts.settlement_ids IS 'Array of settlement IDs included in this payout';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor_id ON vendor_earnings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_booking_id ON vendor_earnings(booking_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_settlement_id ON vendor_earnings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_payout_id ON vendor_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_status ON vendor_earnings(status);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor_status ON vendor_earnings(vendor_id, status);

CREATE INDEX IF NOT EXISTS idx_payouts_vendor_id ON payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_scheduled_at ON payouts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_payouts_vendor_status ON payouts(vendor_id, status);

-- Insert default payout policy
INSERT INTO payout_policies (policy_key, hold_period_days, auto_payout, min_payout_amount, payout_period)
VALUES ('default', 7, false, 1000.00, 'weekly')
ON CONFLICT (policy_key) DO NOTHING;


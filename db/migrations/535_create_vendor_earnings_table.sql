-- ============================================================================
-- MIGRATION 535: Create vendor_earnings table (if missing in production)
-- ============================================================================
-- Mirrors migration 028 but uses IF NOT EXISTS for idempotency.
-- ============================================================================

-- Vendor Earnings Table (track earnings per booking)
CREATE TABLE IF NOT EXISTS vendor_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  settlement_id UUID,
  payout_id UUID,
  amount NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'paid_out', 'cancelled')),
  realized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_out_at TIMESTAMPTZ
);

COMMENT ON TABLE vendor_earnings IS 'Vendor earnings per booking';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor_id ON vendor_earnings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_booking_id ON vendor_earnings(booking_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_settlement_id ON vendor_earnings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_payout_id ON vendor_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_status ON vendor_earnings(status);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor_status ON vendor_earnings(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_earnings_realized_at ON vendor_earnings(realized_at);

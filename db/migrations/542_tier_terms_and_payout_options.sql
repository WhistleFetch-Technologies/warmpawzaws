-- ============================================================================
-- MIGRATION 542: Tier Terms & Conditions + Payout Options
-- ============================================================================
-- Purpose: T&C acceptance per tier; payout schedule options (monthly vs 4-weekly)
-- ============================================================================

-- Add terms_and_conditions to vendor_tiers
ALTER TABLE vendor_tiers
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '1.0';

COMMENT ON COLUMN vendor_tiers.terms_and_conditions IS 'Terms and conditions for this tier - vendor must accept before upgrade';
COMMENT ON COLUMN vendor_tiers.terms_version IS 'Version of terms for audit trail';

-- vendor_tier_acceptances: track T&C acceptance per vendor per tier
CREATE TABLE IF NOT EXISTS vendor_tier_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES vendor_tiers(id) ON DELETE CASCADE,
  
  -- Terms snapshot at time of acceptance
  terms_version TEXT NOT NULL DEFAULT '1.0',
  terms_text_snapshot TEXT,
  
  -- Acceptance metadata
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_via TEXT DEFAULT 'web', -- 'web', 'mobile', 'admin'
  ip_address TEXT,
  user_agent TEXT,
  
  -- Optional: link to subscription if accepted during upgrade
  subscription_id UUID REFERENCES vendor_tier_subscriptions(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(vendor_id, tier_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_vendor_tier_acceptances_vendor ON vendor_tier_acceptances(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tier_acceptances_tier ON vendor_tier_acceptances(tier_id);

COMMENT ON TABLE vendor_tier_acceptances IS 'Tracks vendor acceptance of tier terms and conditions';

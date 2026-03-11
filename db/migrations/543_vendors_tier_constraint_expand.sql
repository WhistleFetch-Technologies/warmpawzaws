-- ============================================================================
-- MIGRATION 543: Expand vendors.tier CHECK constraint
-- ============================================================================
-- Purpose: Allow Basic, Advance, Premium (admin-configured tiers) in addition
--          to legacy Bronze, Silver, Gold, Platinum
-- ============================================================================

-- Drop the restrictive constraint (name may vary by schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'vendors'::regclass 
    AND conname = 'vendors_tier_check'
  ) THEN
    ALTER TABLE vendors DROP CONSTRAINT vendors_tier_check;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Add flexible constraint: allow any non-empty tier name (admin configures in vendor_tiers)
-- Covers: Bronze, Silver, Gold, Platinum, Basic, Advance, Premium, and future admin-created tiers
ALTER TABLE vendors ADD CONSTRAINT vendors_tier_check 
  CHECK (tier IS NULL OR trim(tier) <> '');

COMMENT ON CONSTRAINT vendors_tier_check ON vendors IS 'Tier must be non-empty; valid values configured in vendor_tiers';

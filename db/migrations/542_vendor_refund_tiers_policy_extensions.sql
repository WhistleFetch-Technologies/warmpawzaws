-- Single-source policy extensions on vendor_refund_tiers (cancellation + refund unified).
-- Safe additive migration: NULL = use legacy defaults in app code.

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS policy_extensions jsonb DEFAULT NULL;

COMMENT ON COLUMN vendor_refund_tiers.policy_extensions IS
  'Optional JSON: { rescheduleAllowed?: boolean, noShowPolicy?: { enabled, refundPercentage, penaltyAmount }, providerPolicy?: { penaltyPercentage, compensationPercentage } }. CUSTOMER tiers: reschedule + noShow. PROVIDER tiers: providerPolicy.';

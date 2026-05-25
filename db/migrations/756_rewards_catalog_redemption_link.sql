-- ============================================================================
-- 756: Admin-configured external redemption links on rewards_catalog
-- ============================================================================
-- Enables rewards like Amazon coupon URLs (redeemed at 5000 points, link shown
-- to customer after redemption). Idempotent.
-- ============================================================================

ALTER TABLE rewards_catalog
    ADD COLUMN IF NOT EXISTS redemption_link TEXT;

COMMENT ON COLUMN rewards_catalog.redemption_link IS
    'External coupon/voucher URL shown to customer after points redemption (admin-managed)';

-- Legacy seed rows stay hidden via hidden-rewards-catalog; deactivate in DB too.
UPDATE rewards_catalog
SET is_active = false, updated_at = NOW()
WHERE id IN (
    'e4b8c0d0-1111-4111-a111-000000000001'::uuid,
    'e4b8c0d0-2222-4222-a222-000000000002'::uuid,
    'e4b8c0d0-3333-4333-a333-000000000003'::uuid
)
AND is_active = true;

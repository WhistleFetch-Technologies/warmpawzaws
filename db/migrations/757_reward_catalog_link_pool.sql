-- ============================================================================
-- 757: Unique per-customer coupon link pool for rewards_catalog
-- ============================================================================
-- Admin uploads one URL per line; each redemption assigns the next available link.
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reward_catalog_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_id UUID NOT NULL REFERENCES rewards_catalog (id) ON DELETE CASCADE,
    link_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned')),
    customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
    redemption_id UUID,
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reward_catalog_links_reward_url_unique UNIQUE (reward_id, link_url)
);

CREATE INDEX IF NOT EXISTS idx_reward_catalog_links_reward_available
    ON reward_catalog_links (reward_id, created_at)
    WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_reward_catalog_links_customer
    ON reward_catalog_links (customer_id)
    WHERE customer_id IS NOT NULL;

COMMENT ON TABLE reward_catalog_links IS
    'Pool of unique coupon URLs per catalog reward; one link assigned per customer redemption';

COMMENT ON COLUMN reward_catalog_links.link_url IS 'Unique Amazon/voucher URL — shown only to the customer who redeemed it';

-- Optional FK after reward_redemptions exists (may already be present from 723)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reward_catalog_links_redemption_id_fkey'
    ) THEN
        ALTER TABLE reward_catalog_links
            ADD CONSTRAINT reward_catalog_links_redemption_id_fkey
            FOREIGN KEY (redemption_id) REFERENCES reward_redemptions (id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

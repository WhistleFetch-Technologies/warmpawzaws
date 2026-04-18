-- ============================================================================
-- 723: rewards_catalog + reward_redemptions (customer rewards redeem API)
-- ============================================================================
-- Fixes: relation "rewards_catalog" does not exist on POST/GET rewards paths.
-- Idempotent: CREATE IF NOT EXISTS; seed only when catalog has zero rows.
-- Apply on dev/prod RDS (e.g. scripts/run-migrations-data-api.js or psql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rewards_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    cash_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'discount',
    image_url TEXT,
    validity_days INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_catalog_active_points
    ON rewards_catalog (is_active, points_cost)
    WHERE is_active = true;

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards_catalog (id) ON DELETE RESTRICT,
    points_used INTEGER NOT NULL CHECK (points_used > 0),
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT,
    expires_at TIMESTAMPTZ,
    coupon_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_customer
    ON reward_redemptions (customer_id);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_redeemed_at
    ON reward_redemptions (redeemed_at DESC);

COMMENT ON TABLE rewards_catalog IS 'Points-based rewards offered to customers (Warmpawz rewards UI)';
COMMENT ON TABLE reward_redemptions IS 'History of catalog reward redemptions per customer';

-- Starter catalog (only if table is empty — avoids clobbering admin-managed rows)
INSERT INTO rewards_catalog (id, name, description, points_cost, cash_value, type, is_active, display_order)
SELECT v.id, v.name, v.description, v.points_cost, v.cash_value, v.type, true, v.display_order
FROM (
    VALUES
        ('e4b8c0d0-1111-4111-a111-000000000001'::uuid, '₹100 Off Grooming'::text, 'Get ₹100 off on any grooming service'::text, 100, 100::numeric, 'discount'::text, 10),
        ('e4b8c0d0-2222-4222-a222-000000000002'::uuid, '₹200 Off Vet Visit'::text, 'Get ₹200 off on any vet consultation'::text, 200, 200::numeric, 'discount'::text, 20),
        ('e4b8c0d0-3333-4333-a333-000000000003'::uuid, 'Free Pet Treat'::text, 'Get a free premium pet treat'::text, 50, 50::numeric, 'product'::text, 30)
) AS v(id, name, description, points_cost, cash_value, type, display_order)
WHERE NOT EXISTS (SELECT 1 FROM rewards_catalog LIMIT 1);

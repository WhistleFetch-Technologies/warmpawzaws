-- ============================================================================
-- MIGRATION 1063: E-commerce Admin Promotions (WarmPawz/platform-funded promos)
-- ============================================================================
-- Canonical admin-owned promotion table for the E-COMMERCE (product/shop) domain
-- ONLY, replacing the ad-hoc `promotions` table for product campaigns going
-- forward. Schema intentionally mirrors `vendor_promotions` (minus vendor_id) so
-- the shared evaluation engine in backend/lambda/src/utils/vendor-promotion-engine.ts
-- can be reused as-is.
--
-- Table name note: an unrelated, unmerged "Discount Engine V2 / Commercial
-- Campaign Engine" (meal-plan/subscription domain, branch feature-meal-ui-promotion)
-- already created a DIFFERENT table also named `commercial_discount_campaigns`
-- directly on shared dev RDS with an incompatible schema (funding_type, budget_cap,
-- notification_campaign_id, etc.). This table is deliberately named
-- `ecommerce_admin_promotions` instead to avoid colliding with that table. This
-- migration and its consuming code are E-COMMERCE SCOPE ONLY — do NOT merge with
-- or touch the meal-plan/subscription Discount Engine V2 work.
--
-- Additive only — legacy `promotions` / `platform_promotions` remain untouched
-- and are still read as a fallback during the transition (see
-- backend/lambda/src/utils/resolve-commercial-campaign.ts).
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecommerce_admin_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    name TEXT NOT NULL,
    description TEXT,
    code TEXT, -- Coupon code (optional, uppercase)

    -- Promotion Type
    promotion_type TEXT NOT NULL DEFAULT 'flash_sale' CHECK (
        promotion_type IN ('flash_sale', 'seasonal', 'buy_x_get_y', 'bundle', 'first_order', 'category_discount', 'loyalty')
    ),

    -- Discount Configuration
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_order_value NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),

    -- Validity
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,

    -- Usage Limits
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,

    -- Target Audience
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'new_users', 'returning_users')),

    -- Applicable Products/Categories (JSONB arrays) — empty/null = cart-wide
    applicable_products JSONB,
    applicable_categories JSONB,

    -- BOGO (Buy X Get Y) specific
    buy_quantity INTEGER,
    get_quantity INTEGER,
    get_discount_percent INTEGER,

    -- Bundle specific
    bundle_products JSONB,
    bundle_discount NUMERIC(5, 2),

    -- Funding: this is always a WarmPawz (admin) funded campaign — vendor payout is
    -- unaffected and the platform absorbs the discount out of its own commission/margin
    -- (see backend/lambda/src/utils/ecommerce-settlement-calculator.ts Scenario 3).
    funded_by TEXT NOT NULL DEFAULT 'admin' CHECK (funded_by = 'admin'),

    -- Analytics
    views INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_generated NUMERIC(12, 2) DEFAULT 0,

    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_admin_promotions_code ON ecommerce_admin_promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecommerce_admin_promotions_active ON ecommerce_admin_promotions(is_active, published, start_date, end_date) WHERE is_active = true AND published = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_admin_promotions_unique_code ON ecommerce_admin_promotions(code) WHERE code IS NOT NULL;

COMMENT ON TABLE ecommerce_admin_promotions IS
  'Canonical admin/platform-funded E-COMMERCE (product/shop) promotion campaigns. Server-validated at order creation (see POST /ecommerce/orders promotionSource=admin path). Never combined with a vendor_promotions discount on the same order. Not related to the meal-plan/subscription Discount Engine V2 (commercial_discount_campaigns table).';

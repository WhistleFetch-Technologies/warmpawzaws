-- ============================================================================
-- COUPONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2),
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE coupons ADD CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('percentage', 'fixed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX coupons_pkey ON public.coupons USING btree (id);
CREATE UNIQUE INDEX coupons_code_key ON public.coupons USING btree (code);
CREATE INDEX idx_coupons_dates ON public.coupons USING btree (start_date, end_date);
CREATE INDEX idx_coupons_active ON public.coupons USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE coupons IS 'Coupons - maps from admin:coupons, coupons:list KV keys';
COMMENT ON COLUMN coupons.code IS 'Coupon code (unique)';
COMMENT ON COLUMN coupons.name IS 'Coupon name';
COMMENT ON COLUMN coupons.discount_type IS 'Discount type: percentage, fixed';
COMMENT ON COLUMN coupons.discount_value IS 'Discount value';
COMMENT ON COLUMN coupons.min_order_amount IS 'Minimum order amount';
COMMENT ON COLUMN coupons.max_uses IS 'Maximum number of uses';
COMMENT ON COLUMN coupons.uses_count IS 'Current number of uses';
COMMENT ON COLUMN coupons.start_date IS 'Coupon start date';
COMMENT ON COLUMN coupons.end_date IS 'Coupon end date';

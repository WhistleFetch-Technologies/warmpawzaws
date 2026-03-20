-- ============================================================================
-- PROMOTIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    promotion_type TEXT NOT NULL,
    discount_type TEXT,
    discount_value NUMERIC(10, 2),
    min_order_amount NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE promotions ADD CONSTRAINT promotions_promotion_type_check CHECK (promotion_type IN ('discount', 'cashback', 'loyalty_points', 'free_service'));
ALTER TABLE promotions ADD CONSTRAINT promotions_discount_type_check CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX promotions_pkey ON public.promotions USING btree (id);
CREATE INDEX idx_promotions_type ON public.promotions USING btree (promotion_type);
CREATE INDEX idx_promotions_dates ON public.promotions USING btree (start_date, end_date);
CREATE INDEX idx_promotions_active ON public.promotions USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE promotions IS 'Promotions - maps from platform:promotions, marketing:promotions, promotions:list KV keys';
COMMENT ON COLUMN promotions.name IS 'Promotion name';
COMMENT ON COLUMN promotions.promotion_type IS 'Promotion type: discount, cashback, loyalty_points, free_service';
COMMENT ON COLUMN promotions.discount_type IS 'Discount type: percentage, fixed';
COMMENT ON COLUMN promotions.discount_value IS 'Discount value';
COMMENT ON COLUMN promotions.min_order_amount IS 'Minimum order amount';
COMMENT ON COLUMN promotions.max_discount_amount IS 'Maximum discount amount';
COMMENT ON COLUMN promotions.start_date IS 'Promotion start date';
COMMENT ON COLUMN promotions.end_date IS 'Promotion end date';

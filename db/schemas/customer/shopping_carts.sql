-- ============================================================================
-- SHOPPING_CARTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_carts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) DEFAULT 0,
    tax NUMERIC(10, 2) DEFAULT 0,
    gst NUMERIC(10, 2) DEFAULT 0,
    shipping NUMERIC(10, 2) DEFAULT 0,
    discount NUMERIC(10, 2) DEFAULT 0,
    total NUMERIC(10, 2) DEFAULT 0,
    coupon_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE shopping_carts ADD CONSTRAINT shopping_carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE shopping_carts ADD CONSTRAINT shopping_carts_customer_id_key UNIQUE (customer_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX shopping_carts_pkey ON public.shopping_carts USING btree (id);
CREATE UNIQUE INDEX shopping_carts_customer_id_key ON public.shopping_carts USING btree (customer_id);
CREATE INDEX idx_shopping_carts_customer ON public.shopping_carts USING btree (customer_id);
CREATE INDEX idx_shopping_carts_updated ON public.shopping_carts USING btree (updated_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE shopping_carts IS 'Shopping cart for ecommerce - one cart per customer';
COMMENT ON COLUMN shopping_carts.customer_id IS 'Customer who owns the cart';
COMMENT ON COLUMN shopping_carts.items IS 'JSONB array of cart items: [{product_id, quantity, price, ...}]';
COMMENT ON COLUMN shopping_carts.subtotal IS 'Subtotal before tax and shipping';
COMMENT ON COLUMN shopping_carts.tax IS 'Tax amount';
COMMENT ON COLUMN shopping_carts.gst IS 'GST amount';
COMMENT ON COLUMN shopping_carts.shipping IS 'Shipping charges';
COMMENT ON COLUMN shopping_carts.discount IS 'Discount amount';
COMMENT ON COLUMN shopping_carts.total IS 'Total amount including all charges';
COMMENT ON COLUMN shopping_carts.coupon_code IS 'Applied coupon code (if any)';

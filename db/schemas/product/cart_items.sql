-- ============================================================================
-- CART_ITEMS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT cart_items_customer_product_unique UNIQUE (customer_id, product_id)
);

ALTER TABLE cart_items ADD CONSTRAINT cart_items_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX cart_items_pkey ON cart_items(id);
CREATE UNIQUE INDEX cart_items_customer_product_unique ON cart_items(customer_id, product_id);
CREATE INDEX idx_cart_items_customer_id ON cart_items(customer_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

COMMENT ON TABLE cart_items IS 'Cart items for e-commerce';

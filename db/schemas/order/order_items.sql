-- ============================================================================
-- ORDER_ITEMS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID,
    service_id UUID,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_order_items_service_id ON public.order_items USING btree (service_id) WHERE service_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE order_items IS 'Order items - items in an order';
COMMENT ON COLUMN order_items.order_id IS 'Reference to orders table';
COMMENT ON COLUMN order_items.product_id IS 'Reference to products table (if item is a product)';
COMMENT ON COLUMN order_items.service_id IS 'Reference to services table (if item is a service)';
COMMENT ON COLUMN order_items.name IS 'Item name';
COMMENT ON COLUMN order_items.quantity IS 'Item quantity';
COMMENT ON COLUMN order_items.unit_price IS 'Unit price';
COMMENT ON COLUMN order_items.total_price IS 'Total price (unit_price * quantity)';

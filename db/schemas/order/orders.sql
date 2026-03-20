-- ============================================================================
-- ORDERS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    vendor_id UUID,
    order_number TEXT NOT NULL,
    order_status TEXT NOT NULL DEFAULT 'pending',
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    shipping_amount NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_pincode TEXT NOT NULL,
    shipping_phone TEXT NOT NULL,
    payment_id UUID,
    payment_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE orders ADD CONSTRAINT orders_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);
CREATE UNIQUE INDEX orders_order_number_key ON public.orders USING btree (order_number);
CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX idx_orders_vendor_id ON public.orders USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE orders IS 'E-commerce orders - maps from order:{id} KV keys';
COMMENT ON COLUMN orders.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN orders.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN orders.order_number IS 'Unique order number';
COMMENT ON COLUMN orders.order_status IS 'Order status: pending, confirmed, processing, shipped, delivered, cancelled, returned';
COMMENT ON COLUMN orders.payment_id IS 'Reference to payments table';

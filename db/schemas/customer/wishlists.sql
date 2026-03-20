-- ============================================================================
-- WISHLISTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS wishlists (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    product_id UUID,
    service_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE wishlists ADD CONSTRAINT wishlists_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE wishlists ADD CONSTRAINT wishlists_customer_product_service_key UNIQUE (customer_id, product_id, service_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX wishlists_pkey ON public.wishlists USING btree (id);
CREATE UNIQUE INDEX wishlists_customer_product_service_key ON public.wishlists USING btree (customer_id, product_id, service_id);
CREATE INDEX idx_wishlists_customer ON public.wishlists USING btree (customer_id);
CREATE INDEX idx_wishlists_product ON public.wishlists USING btree (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_wishlists_service ON public.wishlists USING btree (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX idx_wishlists_created ON public.wishlists USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wishlists IS 'Customer wishlists - saved products and services';
COMMENT ON COLUMN wishlists.customer_id IS 'Customer who saved the item';
COMMENT ON COLUMN wishlists.product_id IS 'Product ID if item is a product';
COMMENT ON COLUMN wishlists.service_id IS 'Service ID if item is a service';
COMMENT ON COLUMN wishlists.created_at IS 'When the item was added to wishlist';

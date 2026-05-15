-- ============================================================================
-- PRODUCTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID,
    category_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    price NUMERIC(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    rating NUMERIC(2, 1) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    brand TEXT,
    material TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE products ADD CONSTRAINT products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES ecommerce_categories(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE products ADD CONSTRAINT products_sku_key UNIQUE (sku);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);
CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_products_vendor_id ON public.products USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_products_category_id ON public.products USING btree (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_products_is_active ON public.products USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_products_rating ON public.products USING btree (rating DESC) WHERE rating > 0;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE products IS 'Products - maps from catalog:products KV key';
COMMENT ON COLUMN products.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN products.category_id IS 'Reference to ecommerce_categories table';
COMMENT ON COLUMN products.name IS 'Product name';
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit (unique)';
COMMENT ON COLUMN products.price IS 'Product price';
COMMENT ON COLUMN products.stock_quantity IS 'Stock quantity';
COMMENT ON COLUMN products.rating IS 'Average rating from product reviews';
COMMENT ON COLUMN products.review_count IS 'Total number of product reviews';
COMMENT ON COLUMN products.specifications IS 'Product specifications (JSONB)';

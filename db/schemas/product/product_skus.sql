-- ============================================================================
-- PRODUCT_SKUS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_skus (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    sku TEXT NOT NULL,
    option_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    price NUMERIC(10, 2) NOT NULL,
    compare_at_price NUMERIC(10, 2),
    stock INTEGER NOT NULL DEFAULT 0,
    barcode TEXT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE product_skus ADD CONSTRAINT product_skus_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_skus ADD CONSTRAINT product_skus_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX product_skus_sku_key ON product_skus(sku);
CREATE UNIQUE INDEX product_skus_product_option_values ON product_skus(product_id, option_values);
CREATE INDEX idx_product_skus_product_id ON product_skus(product_id);
CREATE INDEX idx_product_skus_vendor_id ON product_skus(vendor_id);

COMMENT ON TABLE product_skus IS 'Sellable SKU rows per product variant combination';

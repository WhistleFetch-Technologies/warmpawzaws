-- ============================================================================
-- PRODUCT SKUS — sellable variant rows (price, stock, images per SKU)
-- Date: 2026-06-16
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_skus_product_id ON product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_product_skus_vendor_id ON product_skus(vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_skus_sku_key ON product_skus(sku);
CREATE UNIQUE INDEX IF NOT EXISTS product_skus_product_option_values ON product_skus(product_id, option_values);

COMMENT ON TABLE product_skus IS 'Sellable SKU rows per product (size/color combos with own price, stock, images)';
COMMENT ON COLUMN product_skus.option_values IS 'Variant axes e.g. {"size":"M","color":"Red"}';

-- order_items.product_sku_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_items' AND column_name = 'product_sku_id'
    ) THEN
        ALTER TABLE order_items ADD COLUMN product_sku_id UUID REFERENCES product_skus(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_product_sku_id ON order_items(product_sku_id) WHERE product_sku_id IS NOT NULL;

-- cart_items: product_sku_id + selected_variations + unique constraint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_items' AND column_name = 'product_sku_id'
    ) THEN
        ALTER TABLE cart_items ADD COLUMN product_sku_id UUID REFERENCES product_skus(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cart_items' AND column_name = 'selected_variations'
    ) THEN
        ALTER TABLE cart_items ADD COLUMN selected_variations JSONB;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_customer_product_unique'
    ) THEN
        ALTER TABLE cart_items DROP CONSTRAINT cart_items_customer_product_unique;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_customer_product_sku_unique'
    ) THEN
        ALTER TABLE cart_items ADD CONSTRAINT cart_items_customer_product_sku_unique
            UNIQUE (customer_id, product_id, product_sku_id);
    END IF;
END $$;

-- has_variations on products if missing (migration 212)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'has_variations'
    ) THEN
        ALTER TABLE products ADD COLUMN has_variations BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Backfill product_skus from metadata.variants (flat {size,color,price,stock,sku})
INSERT INTO product_skus (
    product_id,
    vendor_id,
    sku,
    option_values,
    price,
    compare_at_price,
    stock,
    images,
    is_active,
    sort_order
)
SELECT
    p.id AS product_id,
    p.vendor_id,
    COALESCE(
        NULLIF(TRIM(v.elem->>'sku'), ''),
        'WP-' || SUBSTRING(REPLACE(p.vendor_id::text, '-', ''), 1, 8) || '-' || SUBSTRING(p.id::text, 1, 8) || '-v' || (v.ord - 1)::text
    ) AS sku,
    jsonb_strip_nulls(
        jsonb_build_object(
            'size',
            CASE
                WHEN v.elem->>'size' IS NOT NULL AND TRIM(v.elem->>'size') <> '' THEN TRIM(v.elem->>'size')
                ELSE NULL
            END,
            'color',
            CASE
                WHEN v.elem->>'color' IS NOT NULL AND TRIM(v.elem->>'color') <> '' THEN TRIM(v.elem->>'color')
                ELSE NULL
            END
        )
    ) AS option_values,
    COALESCE(
        (v.elem->>'price')::numeric,
        p.price
    ) AS price,
    COALESCE(
        (v.elem->>'compare_at_price')::numeric,
        p.compare_at_price
    ) AS compare_at_price,
    COALESCE((v.elem->>'stock')::integer, 0) AS stock,
    '[]'::jsonb AS images,
    true AS is_active,
    (v.ord - 1)::integer AS sort_order
FROM products p
CROSS JOIN LATERAL (
    SELECT elem, ord
    FROM jsonb_array_elements(
        CASE
            WHEN p.metadata IS NOT NULL AND jsonb_typeof(p.metadata->'variants') = 'array'
            THEN p.metadata->'variants'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS t(elem, ord)
) v
WHERE p.vendor_id IS NOT NULL
  AND jsonb_array_length(
        CASE
            WHEN p.metadata IS NOT NULL AND jsonb_typeof(p.metadata->'variants') = 'array'
            THEN p.metadata->'variants'
            ELSE '[]'::jsonb
        END
      ) > 0
  AND NOT EXISTS (
      SELECT 1 FROM product_skus ps WHERE ps.product_id = p.id
  )
ON CONFLICT (sku) DO NOTHING;

-- Mark products with SKUs
UPDATE products p
SET has_variations = true,
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM product_skus ps WHERE ps.product_id = p.id)
  AND COALESCE(p.has_variations, false) = false;

-- Aggregate parent stock for variant products
UPDATE products p
SET stock = sub.total_stock,
    updated_at = now()
FROM (
    SELECT product_id, SUM(stock) AS total_stock
    FROM product_skus
    WHERE is_active = true
    GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND COALESCE(p.has_variations, false) = true;

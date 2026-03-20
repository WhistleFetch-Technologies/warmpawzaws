-- ============================================================================
-- WISHLIST AND PRODUCT VARIATIONS MIGRATION
-- Date: 2026-01-20
-- Purpose: Add customer wishlist and product variations support
-- ============================================================================

-- Customer Wishlist Table
CREATE TABLE IF NOT EXISTS customer_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

-- Index for fast wishlist lookups
CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer ON customer_wishlist(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wishlist_product ON customer_wishlist(product_id);

-- Product Variations Table
CREATE TABLE IF NOT EXISTS product_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Size", "Color", "Weight"
    type VARCHAR(50) NOT NULL DEFAULT 'other', -- 'color', 'size', 'weight', 'other'
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for product variations
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);

-- Product Variation Options Table
CREATE TABLE IF NOT EXISTS product_variation_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_id UUID NOT NULL REFERENCES product_variations(id) ON DELETE CASCADE,
    value VARCHAR(100) NOT NULL, -- e.g., "Red", "Large", "500g"
    price_modifier DECIMAL(10, 2) DEFAULT 0, -- Additional price for this option
    stock_quantity INTEGER DEFAULT 0, -- Stock for this specific variant
    sku VARCHAR(100), -- SKU for this variant
    image_url TEXT, -- Image specific to this variant
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for variation options
CREATE INDEX IF NOT EXISTS idx_variation_options_variation ON product_variation_options(variation_id);

-- Product Views Table for tracking views (needed for recommendations)
-- Check if table exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_views') THEN
        CREATE TABLE product_views (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
            session_id VARCHAR(100),
            viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            source VARCHAR(50) -- 'search', 'category', 'recommendation', 'direct'
        );
    END IF;
END $$;

-- Index for product views (only if table has viewed_at column)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'product_views' AND column_name = 'viewed_at') THEN
        CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_views_customer ON product_views(customer_id);
        CREATE INDEX IF NOT EXISTS idx_product_views_date ON product_views(viewed_at DESC);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'product_views' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_views_customer ON product_views(customer_id);
        CREATE INDEX IF NOT EXISTS idx_product_views_date ON product_views(created_at DESC);
    END IF;
END $$;

-- Cart Items Table (for persistent carts)
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    selected_variations JSONB, -- { "color": "Red", "size": "Large" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

-- Index for cart lookups
CREATE INDEX IF NOT EXISTS idx_cart_items_customer ON cart_items(customer_id);

-- Add has_variations column to products if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'has_variations') THEN
        ALTER TABLE products ADD COLUMN has_variations BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add base_sku column to products if not exists  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'base_sku') THEN
        ALTER TABLE products ADD COLUMN base_sku VARCHAR(100);
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE customer_wishlist IS 'Customer product wishlist for saving favorite items';
COMMENT ON TABLE product_variations IS 'Product variation types like Size, Color, Weight';
COMMENT ON TABLE product_variation_options IS 'Specific options for each variation type';
COMMENT ON TABLE product_views IS 'Tracks product page views for analytics and recommendations';
COMMENT ON TABLE cart_items IS 'Persistent shopping cart items';

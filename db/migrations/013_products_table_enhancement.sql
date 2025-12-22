-- ============================================================================
-- MIGRATION 013: Products Table Enhancement
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add missing columns to products table to support full e-commerce
--          functionality (images, tags, pricing, GST, etc.)
-- ============================================================================

-- Add missing columns to products table
DO $$ BEGIN
    -- Pricing fields
    ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2);
    
    -- Inventory fields
    ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;
    ALTER TABLE products RENAME COLUMN stock_quantity TO stock;
    ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0;
    
    -- Product details
    ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 2);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions TEXT;
    
    -- Media and metadata
    ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
    
    -- Flags
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
    
    -- Tax and compliance
    ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2);
    
    -- Category as text (if category_id is not used)
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
    
    COMMENT ON COLUMN products.compare_at_price IS 'Original price before discount';
    COMMENT ON COLUMN products.cost_price IS 'Cost price for margin calculation';
    COMMENT ON COLUMN products.min_stock IS 'Minimum stock threshold for alerts';
    COMMENT ON COLUMN products.stock IS 'Current stock quantity';
    COMMENT ON COLUMN products.subcategory IS 'Product subcategory';
    COMMENT ON COLUMN products.barcode IS 'Product barcode/UPC';
    COMMENT ON COLUMN products.weight IS 'Product weight in kg';
    COMMENT ON COLUMN products.dimensions IS 'Product dimensions (LxWxH)';
    COMMENT ON COLUMN products.images IS 'Array of image URLs';
    COMMENT ON COLUMN products.tags IS 'Array of product tags';
    COMMENT ON COLUMN products.is_featured IS 'Whether product is featured';
    COMMENT ON COLUMN products.hsn_code IS 'HSN code for GST';
    COMMENT ON COLUMN products.gst_rate IS 'GST rate percentage';
    COMMENT ON COLUMN products.category IS 'Product category (text)';
END $$;

-- Update existing products to have default values
UPDATE products 
SET 
    images = COALESCE(images, '[]'::jsonb),
    tags = COALESCE(tags, '[]'::jsonb),
    min_stock = COALESCE(min_stock, 0),
    is_featured = COALESCE(is_featured, FALSE)
WHERE images IS NULL OR tags IS NULL OR min_stock IS NULL OR is_featured IS NULL;


-- ============================================================================
-- MIGRATION 034: Add Metadata Columns for Meal Products and Orders
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add metadata JSONB columns to products and orders tables
--          to support meal-specific data and order details
-- ============================================================================

-- Add metadata column to products table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE products ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN products.metadata IS 'Additional product metadata (e.g., meal-specific data, nutritional info)';
    END IF;
END $$;

-- Add metadata column to orders table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE orders ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN orders.metadata IS 'Additional order metadata (e.g., meal order details, status history, rider info)';
    END IF;
END $$;

-- Create indexes for common metadata queries
CREATE INDEX IF NOT EXISTS idx_products_metadata_type ON products USING GIN ((metadata->>'type'));
CREATE INDEX IF NOT EXISTS idx_orders_metadata_type ON orders USING GIN ((metadata->>'type'));

COMMENT ON INDEX idx_products_metadata_type IS 'Index for filtering products by metadata type (e.g., meal_product)';
COMMENT ON INDEX idx_orders_metadata_type IS 'Index for filtering orders by metadata type (e.g., meal_order)';


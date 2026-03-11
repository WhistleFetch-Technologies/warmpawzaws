-- ============================================================================
-- MIGRATION 041: Add Tax Fields to Orders Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add tax breakdown fields to orders table for complete tax tracking
-- ============================================================================

-- Add tax-related columns to orders table
DO $$ BEGIN
    -- CGST Amount (Central GST for intrastate transactions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'cgst_amount') THEN
        ALTER TABLE orders ADD COLUMN cgst_amount NUMERIC(10, 2);
    END IF;
    
    -- SGST Amount (State GST for intrastate transactions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'sgst_amount') THEN
        ALTER TABLE orders ADD COLUMN sgst_amount NUMERIC(10, 2);
    END IF;
    
    -- IGST Amount (Integrated GST for interstate transactions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'igst_amount') THEN
        ALTER TABLE orders ADD COLUMN igst_amount NUMERIC(10, 2);
    END IF;
    
    -- Tax Breakdown (JSONB) - Complete tax calculation result
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'tax_breakdown') THEN
        ALTER TABLE orders ADD COLUMN tax_breakdown JSONB;
    END IF;
END $$;

-- Add indexes for tax-related queries (optional, for reporting)
CREATE INDEX IF NOT EXISTS idx_orders_cgst_amount ON orders(cgst_amount) WHERE cgst_amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sgst_amount ON orders(sgst_amount) WHERE sgst_amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_igst_amount ON orders(igst_amount) WHERE igst_amount IS NOT NULL;

-- Add comments
COMMENT ON COLUMN orders.cgst_amount IS 'Central GST amount (intrastate transactions)';
COMMENT ON COLUMN orders.sgst_amount IS 'State GST amount (intrastate transactions)';
COMMENT ON COLUMN orders.igst_amount IS 'Integrated GST amount (interstate transactions)';
COMMENT ON COLUMN orders.tax_breakdown IS 'Complete tax calculation breakdown (JSONB) - includes per-item tax, HSN summary, and totals';


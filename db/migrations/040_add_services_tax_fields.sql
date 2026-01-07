-- ============================================================================
-- MIGRATION 040: Add Tax Fields to Services Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add HSN code and GST rate fields to services table for tax management
-- ============================================================================

-- Add tax-related columns to services table
DO $$ BEGIN
    -- HSN Code for services
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' AND column_name = 'hsn_code') THEN
        ALTER TABLE services ADD COLUMN hsn_code TEXT;
    END IF;
    
    -- GST Rate for services
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' AND column_name = 'gst_rate') THEN
        ALTER TABLE services ADD COLUMN gst_rate NUMERIC(5, 2);
    END IF;
    
    -- Tax category for services
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' AND column_name = 'tax_category_id') THEN
        ALTER TABLE services ADD COLUMN tax_category_id UUID REFERENCES tax_categories(id);
    END IF;
END $$;

-- Add indexes for tax-related queries
CREATE INDEX IF NOT EXISTS idx_services_hsn_code ON services(hsn_code) WHERE hsn_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_tax_category ON services(tax_category_id) WHERE tax_category_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN services.hsn_code IS 'HSN code for GST tax calculation';
COMMENT ON COLUMN services.gst_rate IS 'GST rate percentage for this service (overrides HSN code rate if set)';
COMMENT ON COLUMN services.tax_category_id IS 'Tax category for this service';


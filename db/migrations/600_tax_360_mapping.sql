-- ============================================================================
-- MIGRATION 600: Tax 360-Degree Mapping
-- ============================================================================
-- Purpose: Link service_catalog and gst_rules to GST Configuration (Tax Categories, HSN Codes)
--          for single-source-of-truth taxation at transaction time.
-- Date: 2026-02-05
-- Ref: docs/TAX_HSN_360_MAPPING_ANALYSIS.md
-- ============================================================================

-- ============================================================================
-- 1. ADD tax_category_id TO service_catalog
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_catalog' AND column_name = 'tax_category_id'
  ) THEN
    ALTER TABLE service_catalog 
    ADD COLUMN tax_category_id UUID REFERENCES tax_categories(id);
    CREATE INDEX IF NOT EXISTS idx_service_catalog_tax_category 
      ON service_catalog(tax_category_id) WHERE tax_category_id IS NOT NULL;
    COMMENT ON COLUMN service_catalog.tax_category_id IS 'Tax category for this service - links to GST Configuration';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD hsn_code_id TO service_catalog (optional - for specific HSN when needed)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_catalog' AND column_name = 'hsn_code_id'
  ) THEN
    ALTER TABLE service_catalog 
    ADD COLUMN hsn_code_id UUID REFERENCES hsn_codes(id);
    CREATE INDEX IF NOT EXISTS idx_service_catalog_hsn_code 
      ON service_catalog(hsn_code_id) WHERE hsn_code_id IS NOT NULL;
    COMMENT ON COLUMN service_catalog.hsn_code_id IS 'HSN code for this service - overrides tax_category rate when set';
  END IF;
END $$;

-- ============================================================================
-- 3. ADD tax_category_id TO gst_rules (alongside existing category TEXT)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gst_rules' AND column_name = 'tax_category_id'
  ) THEN
    ALTER TABLE gst_rules 
    ADD COLUMN tax_category_id UUID REFERENCES tax_categories(id);
    CREATE INDEX IF NOT EXISTS idx_gst_rules_tax_category 
      ON gst_rules(tax_category_id) WHERE tax_category_id IS NOT NULL;
    COMMENT ON COLUMN gst_rules.tax_category_id IS 'Tax category for rule - selection not free text';
  END IF;
END $$;

-- ============================================================================
-- 4. ENSURE hsn_codes has category_id (for Tax Category linkage)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hsn_codes' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE hsn_codes 
    ADD COLUMN category_id UUID REFERENCES tax_categories(id);
    CREATE INDEX IF NOT EXISTS idx_hsn_codes_category 
      ON hsn_codes(category_id) WHERE category_id IS NOT NULL;
    COMMENT ON COLUMN hsn_codes.category_id IS 'Tax category for this HSN code';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL; -- tax_categories might not exist in some envs
END $$;

-- ============================================================================
-- 5. HANDLE hsn_codes column variance (code vs hsn_code)
-- Migration 213 uses 'code', schema uses 'hsn_code' - ensure compatibility
-- ============================================================================
DO $$ BEGIN
  -- If hsn_codes has 'code' but not 'hsn_code', add hsn_code as copy
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hsn_codes' AND column_name = 'code')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hsn_codes' AND column_name = 'hsn_code')
  THEN
    ALTER TABLE hsn_codes ADD COLUMN hsn_code TEXT;
    UPDATE hsn_codes SET hsn_code = code WHERE hsn_code IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hsn_codes_hsn_code_unique ON hsn_codes(hsn_code) WHERE hsn_code IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

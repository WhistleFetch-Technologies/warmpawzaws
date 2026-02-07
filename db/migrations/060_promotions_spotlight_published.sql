-- ============================================================================
-- MIGRATION 060: Add Spotlight and Published Fields to Promotions
-- ============================================================================
-- Date: 2025-01-30
-- Purpose: Add is_spotlight and published fields for promotion system enhancement
-- Phase: 0.1 - Promotion System Integration
-- ============================================================================

-- Add is_spotlight and published fields
DO $$ BEGIN
    -- Add is_spotlight field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='is_spotlight') THEN
        ALTER TABLE promotions ADD COLUMN is_spotlight BOOLEAN DEFAULT false;
    END IF;
    
    -- Add published field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='published') THEN
        ALTER TABLE promotions ADD COLUMN published BOOLEAN DEFAULT false;
    END IF;
    
    COMMENT ON COLUMN promotions.is_spotlight IS 'If true, promotion appears in spotlight section on service dashboards';
    COMMENT ON COLUMN promotions.published IS 'If true, promotion is visible to customers. If false, promotion is draft.';
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_promotions_spotlight ON promotions(is_spotlight) WHERE is_spotlight = true;
CREATE INDEX IF NOT EXISTS idx_promotions_published ON promotions(published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_promotions_spotlight_published ON promotions(is_spotlight, published) WHERE is_spotlight = true AND published = true;

-- Create GIN index for applicable_services array queries (if not exists)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'promotions' 
        AND indexname = 'idx_promotions_applicable_services_gin'
    ) THEN
        CREATE INDEX idx_promotions_applicable_services_gin ON promotions USING GIN(applicable_services);
    END IF;
END $$;

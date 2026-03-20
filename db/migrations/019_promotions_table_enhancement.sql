-- ============================================================================
-- MIGRATION 019: Promotions Table Enhancement
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Add missing columns to promotions table for complete functionality
-- Migration: Phase 1, Task 1.3 - KV to SQL
-- ============================================================================

-- Add missing columns to promotions table
DO $$ BEGIN
    -- Add priority field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='priority') THEN
        ALTER TABLE promotions ADD COLUMN priority INTEGER DEFAULT 0;
    END IF;
    
    -- Add applicable_services (JSONB array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='applicable_services') THEN
        ALTER TABLE promotions ADD COLUMN applicable_services JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add applicable_roles (JSONB array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='applicable_roles') THEN
        ALTER TABLE promotions ADD COLUMN applicable_roles JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add usage_limit and usage_count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='usage_limit') THEN
        ALTER TABLE promotions ADD COLUMN usage_limit INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='usage_count') THEN
        ALTER TABLE promotions ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
    
    -- Change start_date and end_date to TIMESTAMPTZ for better date handling
    -- (Keep as DATE if already TIMESTAMPTZ, just ensure consistency)
    
    COMMENT ON COLUMN promotions.priority IS 'Priority for promotion sorting (higher = more priority)';
    COMMENT ON COLUMN promotions.applicable_services IS 'Array of service types this promotion applies to';
    COMMENT ON COLUMN promotions.applicable_roles IS 'Array of vendor role IDs this promotion applies to';
    COMMENT ON COLUMN promotions.usage_limit IS 'Maximum number of times this promotion can be used';
    COMMENT ON COLUMN promotions.usage_count IS 'Number of times this promotion has been used';
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_priority ON promotions(priority DESC);


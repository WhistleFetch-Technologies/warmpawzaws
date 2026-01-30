-- ============================================================================
-- MIGRATION 504: Add category column to diagnostic_tests (schema alignment)
-- ============================================================================
-- Fixes: column "category" of relation "diagnostic_tests" does not exist
-- Migration 057 created table with test_category; 021 uses category.
-- This adds category and syncs from test_category for compatibility.
-- ============================================================================

-- Add category column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'diagnostic_tests' 
          AND column_name = 'category'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN category VARCHAR(100);
        -- Copy existing data from test_category if that column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'diagnostic_tests' 
              AND column_name = 'test_category'
        ) THEN
            UPDATE diagnostic_tests SET category = test_category WHERE test_category IS NOT NULL;
            RAISE NOTICE 'Copied test_category to category';
        END IF;
        RAISE NOTICE 'Added category column to diagnostic_tests';
    ELSE
        RAISE NOTICE 'category column already exists in diagnostic_tests';
    END IF;
END $$;

-- Add sample_type and preparation_instructions if missing (021 schema)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'diagnostic_tests' 
          AND column_name = 'sample_type'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN sample_type VARCHAR(50);
        RAISE NOTICE 'Added sample_type column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'diagnostic_tests' 
          AND column_name = 'preparation_instructions'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN preparation_instructions TEXT;
        RAISE NOTICE 'Added preparation_instructions column to diagnostic_tests';
    END IF;
END $$;

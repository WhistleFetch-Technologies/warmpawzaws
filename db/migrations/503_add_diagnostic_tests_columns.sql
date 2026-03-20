-- ============================================================================
-- MIGRATION 503: Add missing columns to diagnostic_tests table
-- ============================================================================
-- Fixes the error: column "test_code" of relation "diagnostic_tests" does not exist
-- These columns are expected by the specialized-services.ts endpoint but may be missing
-- from the actual database table.
-- ============================================================================

-- Add test_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'test_code'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN test_code VARCHAR(50);
        RAISE NOTICE 'Added test_code column to diagnostic_tests';
    ELSE
        RAISE NOTICE 'test_code column already exists in diagnostic_tests';
    END IF;
END $$;

-- Add additional columns that may be missing (from gap fixes migration 412)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'is_free_home_collection'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN is_free_home_collection BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_free_home_collection column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'home_collection_fee'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN home_collection_fee DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added home_collection_fee column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'terms_conditions'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN terms_conditions TEXT;
        RAISE NOTICE 'Added terms_conditions column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'turnaround_time_hours'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN turnaround_time_hours INTEGER;
        RAISE NOTICE 'Added turnaround_time_hours column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'is_package_available'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN is_package_available BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_package_available column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'package_price'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN package_price DECIMAL(10,2);
        RAISE NOTICE 'Added package_price column to diagnostic_tests';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests' AND column_name = 'package_test_count'
    ) THEN
        ALTER TABLE diagnostic_tests ADD COLUMN package_test_count INTEGER;
        RAISE NOTICE 'Added package_test_count column to diagnostic_tests';
    END IF;
END $$;

-- Create index on test_code if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_test_code ON diagnostic_tests(test_code);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'diagnostic_tests'
ORDER BY ordinal_position;

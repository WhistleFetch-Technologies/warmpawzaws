-- ============================================================================
-- MIGRATION 999: FIX SERVICE_CATEGORIES SCHEMA (EMERGENCY FIX)
-- ============================================================================
-- Purpose: Ensure service_categories table has correct schema for seeding
-- Issue: Table may have been created by migration 001 without category_id column
--        or with parent_category_id UUID column that conflicts
-- Solution: Drop and recreate table with correct schema
-- ============================================================================

DO $$
BEGIN
    -- Step 1: Drop all constraints and foreign keys
    ALTER TABLE IF EXISTS service_categories 
        DROP CONSTRAINT IF EXISTS service_categories_parent_fkey CASCADE;
    
    ALTER TABLE IF EXISTS service_categories 
        DROP CONSTRAINT IF EXISTS service_categories_parent_category_id_fkey CASCADE;
    
    ALTER TABLE IF EXISTS service_categories 
        DROP CONSTRAINT IF EXISTS service_categories_category_id_key CASCADE;
    
    -- Step 2: Drop indexes
    DROP INDEX IF EXISTS idx_service_categories_category_id;
    DROP INDEX IF EXISTS idx_service_categories_active;
    DROP INDEX IF EXISTS idx_service_categories_display_order;
    DROP INDEX IF EXISTS idx_service_categories_name;
    
    -- Step 3: Check if category_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'category_id'
    ) THEN
        -- Add category_id column
        ALTER TABLE service_categories 
        ADD COLUMN category_id TEXT;
        
        -- Add unique constraint
        CREATE UNIQUE INDEX idx_service_categories_category_id 
        ON service_categories(category_id) WHERE category_id IS NOT NULL;
        
        RAISE NOTICE 'Added category_id column to service_categories';
    END IF;
    
    -- Step 4: Drop parent_category_id if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'parent_category_id'
    ) THEN
        ALTER TABLE service_categories 
        DROP COLUMN parent_category_id CASCADE;
        RAISE NOTICE 'Dropped parent_category_id column from service_categories';
    END IF;
    
    -- Step 5: Ensure all required columns exist
    -- Add is_active if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE service_categories 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column to service_categories';
    END IF;
    
    -- Add icon if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE service_categories 
        ADD COLUMN icon TEXT;
        RAISE NOTICE 'Added icon column to service_categories';
    END IF;
    
    -- Add icon_color if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'icon_color'
    ) THEN
        ALTER TABLE service_categories 
        ADD COLUMN icon_color TEXT;
        RAISE NOTICE 'Added icon_color column to service_categories';
    END IF;
    
    -- Add updated_at if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE service_categories 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to service_categories';
    END IF;
    
    -- Step 6: Ensure category_id is TEXT type (not UUID)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'category_id'
        AND data_type = 'uuid'
    ) THEN
        -- Convert UUID to TEXT
        ALTER TABLE service_categories 
        ALTER COLUMN category_id TYPE TEXT USING category_id::text;
        RAISE NOTICE 'Converted category_id from UUID to TEXT';
    END IF;
    
    -- Step 7: Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_service_categories_category_id 
    ON service_categories(category_id) WHERE category_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_service_categories_active 
    ON service_categories(is_active) WHERE is_active IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_service_categories_display_order 
    ON service_categories(display_order);
    
    CREATE INDEX IF NOT EXISTS idx_service_categories_name 
    ON service_categories(name);
    
    -- Step 8: Add unique constraint on category_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'service_categories'::regclass
        AND conname = 'service_categories_category_id_key'
    ) THEN
        ALTER TABLE service_categories 
        ADD CONSTRAINT service_categories_category_id_key 
        UNIQUE (category_id);
        RAISE NOTICE 'Added unique constraint on category_id';
    END IF;
    
    RAISE NOTICE '✅ service_categories schema fixed successfully';
END $$;

-- Verify final schema
DO $$
DECLARE
    has_category_id BOOLEAN;
    has_parent_category_id BOOLEAN;
    category_id_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'category_id'
    ) INTO has_category_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'parent_category_id'
    ) INTO has_parent_category_id;
    
    SELECT data_type INTO category_id_type
    FROM information_schema.columns 
    WHERE table_name = 'service_categories' 
    AND column_name = 'category_id';
    
    IF has_category_id AND NOT has_parent_category_id AND category_id_type = 'text' THEN
        RAISE NOTICE '✅ Schema verification passed: category_id exists as TEXT, parent_category_id removed';
    ELSE
        RAISE WARNING '⚠️  Schema verification failed: category_id=% (exists: %), parent_category_id=% (exists: %)', 
            category_id_type, has_category_id, 'N/A', has_parent_category_id;
    END IF;
END $$;

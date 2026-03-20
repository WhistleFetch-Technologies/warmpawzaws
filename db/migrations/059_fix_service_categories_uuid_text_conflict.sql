-- ============================================================================
-- MIGRATION 059: FIX SERVICE CATEGORIES UUID/TEXT CONFLICT
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Resolve UUID/text type mismatch in service_categories table
-- Issue: parent_category_id UUID (migration 002) conflicts with category_id TEXT (migration 048)
-- Solution: Drop parent_category_id column and foreign key constraint
-- ============================================================================

-- Step 1: Drop foreign key constraint if it exists
DO $$
BEGIN
    -- Drop the foreign key constraint on parent_category_id
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'service_categories_parent_category_id_fkey'
    ) THEN
        ALTER TABLE service_categories 
        DROP CONSTRAINT service_categories_parent_category_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint: service_categories_parent_category_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint does not exist, skipping';
    END IF;
END $$;

-- Step 2: Drop parent_category_id column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'parent_category_id'
    ) THEN
        ALTER TABLE service_categories 
        DROP COLUMN parent_category_id;
        RAISE NOTICE 'Dropped column: parent_category_id';
    ELSE
        RAISE NOTICE 'Column parent_category_id does not exist, skipping';
    END IF;
END $$;

-- Step 3: Ensure category_id column exists and is TEXT type
DO $$
BEGIN
    -- Check if category_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'category_id'
    ) THEN
        -- Add category_id column if it doesn't exist
        ALTER TABLE service_categories 
        ADD COLUMN category_id TEXT UNIQUE;
        RAISE NOTICE 'Added category_id column';
    ELSE
        -- Ensure it's TEXT type (not UUID)
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'service_categories' 
            AND column_name = 'category_id'
            AND data_type = 'uuid'
        ) THEN
            -- Convert UUID to TEXT if needed
            ALTER TABLE service_categories 
            ALTER COLUMN category_id TYPE TEXT USING category_id::text;
            RAISE NOTICE 'Converted category_id from UUID to TEXT';
        ELSE
            RAISE NOTICE 'category_id column already exists as TEXT';
        END IF;
    END IF;
END $$;

-- Step 4: Add unique constraint on category_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'service_categories_category_id_key'
    ) THEN
        ALTER TABLE service_categories 
        ADD CONSTRAINT service_categories_category_id_key UNIQUE (category_id);
        RAISE NOTICE 'Added unique constraint on category_id';
    ELSE
        RAISE NOTICE 'Unique constraint on category_id already exists';
    END IF;
END $$;

-- Step 5: Create index on category_id if not exists
CREATE INDEX IF NOT EXISTS idx_service_categories_category_id 
ON service_categories(category_id);

-- Step 6: Verify the fix
DO $$
DECLARE
    column_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Check columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'service_categories' 
    AND column_name IN ('category_id', 'parent_category_id');
    
    -- Check constraints
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conrelid = 'service_categories'::regclass
    AND conname LIKE '%parent_category%';
    
    IF column_count = 1 AND constraint_count = 0 THEN
        RAISE NOTICE '✅ Migration successful: parent_category_id removed, category_id is TEXT';
    ELSE
        RAISE WARNING '⚠️  Migration may not be complete. Column count: %, Constraint count: %', column_count, constraint_count;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration resolves the UUID/text conflict by:
-- 1. Dropping the parent_category_id UUID column
-- 2. Dropping the foreign key constraint
-- 3. Ensuring category_id is TEXT type
-- 4. Adding proper constraints and indexes
-- ============================================================================

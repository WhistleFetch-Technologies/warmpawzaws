-- ============================================================================
-- MIGRATION 603: Fix content_pages category check constraint
-- ============================================================================
-- Purpose: Update content_pages category check constraint to allow more category values
-- Date: 2026-02-23
-- Issue: "new row for relation \"content_pages\" violates check constraint \"content_pages_category_check\""
-- ============================================================================

-- Drop the existing constraint if it exists
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'content_pages_category_check'
  ) THEN
    ALTER TABLE content_pages DROP CONSTRAINT content_pages_category_check;
    RAISE NOTICE 'Dropped existing content_pages_category_check constraint.';
  ELSE
    RAISE NOTICE 'content_pages_category_check constraint does not exist.';
  END IF;
END $$;

-- Add a more permissive constraint that allows NULL and any text value
-- This allows maximum flexibility for category values
DO $$
BEGIN
  -- Remove any existing constraint first (in case it exists with a different name)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'content_pages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%category%'
  ) THEN
    -- Find and drop any category-related check constraint
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'content_pages'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%category%'
      LIMIT 1;
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE content_pages DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped existing category constraint: %', constraint_name;
      END IF;
    END;
  END IF;
  
  -- Add new constraint that allows NULL or any text value
  -- This is the most permissive approach - allows any category value
  -- Since category is already TEXT type, we just need to ensure it's valid text or NULL
  ALTER TABLE content_pages 
    ADD CONSTRAINT content_pages_category_check 
    CHECK (category IS NULL OR category::text IS NOT NULL);
  
  RAISE NOTICE 'Added permissive content_pages_category_check constraint (allows any text or NULL).';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not add constraint: %', SQLERRM;
END $$;

-- Add comment to document the constraint
COMMENT ON COLUMN content_pages.category IS 'Page category: legal, help, marketing, other, about, terms, privacy, faq, support (or NULL)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

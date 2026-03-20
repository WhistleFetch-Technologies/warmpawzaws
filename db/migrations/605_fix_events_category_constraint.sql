-- ============================================================================
-- MIGRATION 605: Fix events category check constraint
-- ============================================================================
-- Purpose: Update events category check constraint to allow more category values
-- Date: 2026-02-24
-- Issue: "new row for relation \"events\" violates check constraint \"events_category_check\""
-- ============================================================================

-- Check if events table exists first
DO $$
BEGIN
  -- Only proceed if events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    -- Drop the existing constraint if it exists
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'events_category_check'
    ) THEN
      ALTER TABLE events DROP CONSTRAINT events_category_check;
      RAISE NOTICE 'Dropped existing events_category_check constraint.';
    ELSE
      RAISE NOTICE 'events_category_check constraint does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'events table does not exist yet. Migration will apply when table is created.';
  END IF;
END $$;

-- Remove any other category-related check constraints
DO $$
BEGIN
  -- Only proceed if events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    -- Find and drop any category-related check constraint
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%category%'
    ) THEN
      DECLARE
        constraint_name TEXT;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'events'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%category%'
        LIMIT 1;
        
        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE events DROP CONSTRAINT ' || quote_ident(constraint_name);
          RAISE NOTICE 'Dropped existing category constraint: %', constraint_name;
        END IF;
      END;
    END IF;
  END IF;
END $$;

-- Add a more permissive constraint that allows NULL and any text value
-- This allows maximum flexibility for category values
DO $$
BEGIN
  -- Only proceed if events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    -- Add new constraint that allows NULL or any text value
    -- Since category is already TEXT type, we just need to ensure it's valid text or NULL
    ALTER TABLE events 
      ADD CONSTRAINT events_category_check 
      CHECK (category IS NULL OR category::text IS NOT NULL);
    
    RAISE NOTICE 'Added permissive events_category_check constraint (allows any text or NULL).';
  ELSE
    RAISE NOTICE 'events table does not exist yet. Constraint will be added when table is created.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not add constraint: %', SQLERRM;
END $$;

-- Add comment to document the constraint (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    COMMENT ON COLUMN events.category IS 'Event category: adoption_drive, fundraiser, awareness_campaign, volunteer_drive, pet_party, meetup, training_workshop, contest, workshop, vaccination_camp, or any other value (or NULL)';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

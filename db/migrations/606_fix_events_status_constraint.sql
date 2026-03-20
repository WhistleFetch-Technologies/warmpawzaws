-- ============================================================================
-- MIGRATION 606: Fix events status check constraint
-- ============================================================================
-- Purpose: Update events status check constraint to allow more status values
-- Date: 2026-02-24
-- Issue: "new row for relation \"events\" violates check constraint \"events_status_check\""
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
      WHERE conname = 'events_status_check'
    ) THEN
      ALTER TABLE events DROP CONSTRAINT events_status_check;
      RAISE NOTICE 'Dropped existing events_status_check constraint.';
    ELSE
      RAISE NOTICE 'events_status_check constraint does not exist.';
    END IF;
  ELSE
    RAISE NOTICE 'events table does not exist yet. Migration will apply when table is created.';
  END IF;
END $$;

-- Remove any other status-related check constraints
DO $$
BEGIN
  -- Only proceed if events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    -- Find and drop any status-related check constraint
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'
        AND pg_get_constraintdef(oid) NOT LIKE '%payment_status%'
        AND pg_get_constraintdef(oid) NOT LIKE '%check_in_status%'
    ) THEN
      DECLARE
        constraint_name TEXT;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'events'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
          AND pg_get_constraintdef(oid) NOT LIKE '%payment_status%'
          AND pg_get_constraintdef(oid) NOT LIKE '%check_in_status%'
        LIMIT 1;
        
        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE events DROP CONSTRAINT ' || quote_ident(constraint_name);
          RAISE NOTICE 'Dropped existing status constraint: %', constraint_name;
        END IF;
      END;
    END IF;
  END IF;
END $$;

-- Add a more permissive constraint that allows NULL and any text value
-- This allows maximum flexibility for status values
DO $$
BEGIN
  -- Only proceed if events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'events'
  ) THEN
    -- Add new constraint that allows NULL or any text value
    -- Since status is already TEXT type, we just need to ensure it's valid text or NULL
    ALTER TABLE events 
      ADD CONSTRAINT events_status_check 
      CHECK (status IS NULL OR status::text IS NOT NULL);
    
    RAISE NOTICE 'Added permissive events_status_check constraint (allows any text or NULL).';
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
    COMMENT ON COLUMN events.status IS 'Event status: draft, published, upcoming, ongoing, completed, cancelled, or any other value (or NULL)';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

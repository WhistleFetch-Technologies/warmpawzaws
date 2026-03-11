-- ============================================================================
-- MIGRATION 505: Adhoc Home Sample Collection Agent Support
-- ============================================================================
-- Purpose: Allow assigning adhoc agents (name, phone) for home sample collection
-- without requiring staff_id. Agent does not need login.
-- ============================================================================

-- Add adhoc agent columns
ALTER TABLE sample_collection_assignments 
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone TEXT;

-- Make staff_id nullable when using adhoc agent
-- (PostgreSQL: ALTER COLUMN ... DROP NOT NULL)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sample_collection_assignments' 
    AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE sample_collection_assignments ALTER COLUMN staff_id DROP NOT NULL;
    RAISE NOTICE 'Made staff_id nullable for adhoc agent support';
  END IF;
END $$;

-- Add check: either staff_id OR (agent_name AND agent_phone) must be set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sample_collection_assignments_agent_or_staff'
  ) THEN
    ALTER TABLE sample_collection_assignments 
    ADD CONSTRAINT sample_collection_assignments_agent_or_staff 
    CHECK (staff_id IS NOT NULL OR (agent_name IS NOT NULL AND agent_phone IS NOT NULL));
    RAISE NOTICE 'Added agent_or_staff constraint';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint sample_collection_assignments_agent_or_staff already exists';
END $$;

COMMENT ON COLUMN sample_collection_assignments.agent_name IS 'Adhoc agent name when staff_id is not used';
COMMENT ON COLUMN sample_collection_assignments.agent_phone IS 'Adhoc agent phone - customer notified with this';

-- ============================================================================
-- MIGRATION: Fix vendor_services publish_status constraint to include all required statuses
-- Version: 550
-- Description: Ensures publish_status constraint includes all statuses needed for custom service approval workflow
--              Includes: draft, pending_approval, published, rejected, auto_published
-- ============================================================================

-- Drop existing check constraint (name may be vendor_services_publish_status_check or similar)
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vendor_services'
      AND c.contype = 'c'
      AND (pg_get_constraintdef(c.oid) LIKE '%publish_status%' OR c.conname LIKE '%publish_status%')
  LOOP
    EXECUTE format('ALTER TABLE vendor_services DROP CONSTRAINT IF EXISTS %I', conname);
    RAISE NOTICE 'Dropped constraint % on vendor_services', conname;
  END LOOP;
END $$;

-- Add new constraint with all required statuses
ALTER TABLE vendor_services
  ADD CONSTRAINT vendor_services_publish_status_check
  CHECK (publish_status IN ('draft', 'pending_approval', 'published', 'rejected', 'auto_published'));

COMMENT ON COLUMN vendor_services.publish_status IS 'draft | pending_approval (awaiting admin) | published | rejected | auto_published';

-- ============================================================================
-- END OF MIGRATION 550
-- ============================================================================

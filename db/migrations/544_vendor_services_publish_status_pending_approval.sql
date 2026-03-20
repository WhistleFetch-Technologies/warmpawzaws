-- Migration: Allow 'pending_approval' in vendor_services.publish_status
-- Purpose: Custom service creation and publish flow use pending_approval for admin approval.
-- Without this, INSERT fails with check constraint violation when creating custom services.
-- Date: 2026-02-05

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

ALTER TABLE vendor_services
  ADD CONSTRAINT vendor_services_publish_status_check
  CHECK (publish_status IN ('draft', 'published', 'auto_published', 'pending_approval'));

COMMENT ON COLUMN vendor_services.publish_status IS 'draft | pending_approval (awaiting admin) | published | auto_published';

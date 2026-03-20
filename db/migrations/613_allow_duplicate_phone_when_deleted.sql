-- ============================================================================
-- MIGRATION 613: Allow duplicate phone numbers when old records are soft-deleted
-- Date: 2026-03-10
-- Purpose: Replace UNIQUE constraints on phone columns with partial unique indexes
--          that only enforce uniqueness among non-deleted rows (is_deleted = false)
-- ============================================================================
-- This migration allows the same phone number to be reused when old vendor or
-- vendor_identity records are soft-deleted (is_deleted = true).
-- 
-- Changes:
-- 1. Remove UNIQUE constraint from vendors.phone
-- 2. Create partial unique index on vendors.phone (only for is_deleted = false)
-- 3. Remove UNIQUE constraint from vendor_identity.phone
-- 4. Create partial unique index on vendor_identity.phone (only for is_deleted = false)
-- ============================================================================

DO $$
BEGIN
  -- ============================================================================
  -- VENDORS TABLE
  -- ============================================================================
  
  -- Drop existing unique constraint on vendors.phone (if it exists)
  -- PostgreSQL creates constraints with names like: vendors_phone_key, vendors_phone_unique, etc.
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'vendors'::regclass 
    AND conname LIKE '%phone%' 
    AND contype = 'u'
  ) THEN
    -- Find and drop the constraint
    DO $drop_vendor_constraint$
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'vendors'::regclass
      AND conname LIKE '%phone%'
      AND contype = 'u'
      LIMIT 1;
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE vendors DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped unique constraint: %', constraint_name;
      END IF;
    END $drop_vendor_constraint$;
  END IF;
  
  -- Drop old plain index if it exists (we'll replace it with partial unique index)
  DROP INDEX IF EXISTS idx_vendors_phone;
  
  -- Create partial unique index: phone must be unique ONLY among non-deleted rows
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_phone_unique_active
    ON vendors (phone)
    WHERE is_deleted = false;
  
  RAISE NOTICE 'Created partial unique index: idx_vendors_phone_unique_active on vendors(phone) WHERE is_deleted = false';
  
  -- ============================================================================
  -- VENDOR_IDENTITY TABLE
  -- ============================================================================
  
  -- Drop existing unique constraint on vendor_identity.phone (if it exists)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'vendor_identity'::regclass 
    AND conname LIKE '%phone%' 
    AND contype = 'u'
  ) THEN
    -- Find and drop the constraint
    DO $drop_identity_constraint$
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'vendor_identity'::regclass
      AND conname LIKE '%phone%'
      AND contype = 'u'
      LIMIT 1;
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE vendor_identity DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped unique constraint: %', constraint_name;
      END IF;
    END $drop_identity_constraint$;
  END IF;
  
  -- Drop old plain index if it exists (we'll replace it with partial unique index)
  DROP INDEX IF EXISTS idx_vendor_identity_phone;
  
  -- Create partial unique index: phone must be unique ONLY among non-deleted rows
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_identity_phone_unique_active
    ON vendor_identity (phone)
    WHERE is_deleted = false;
  
  RAISE NOTICE 'Created partial unique index: idx_vendor_identity_phone_unique_active on vendor_identity(phone) WHERE is_deleted = false';
  
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 1. Multiple rows with same phone are allowed if at least one has is_deleted = true
-- 2. Multiple rows with same phone and is_deleted = false will still be blocked
-- 3. Indexes exist:
--    SELECT indexname FROM pg_indexes WHERE tablename IN ('vendors', 'vendor_identity') AND indexname LIKE '%phone%';
-- ============================================================================

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

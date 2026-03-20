-- ============================================================================
-- MIGRATION 143: DELETE INACTIVE ROLES
-- ============================================================================
-- Date: 2026-01-17
-- Purpose: Physically delete all inactive roles from the database
-- ============================================================================
-- WARNING: This will permanently delete inactive roles
-- Make sure to backup before running this migration
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Check for foreign key references to inactive roles
-- ============================================================================

-- Check if any inactive roles are referenced by vendor_identity
DO $$
DECLARE
  referenced_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO referenced_count
  FROM vendor_identity vi
  INNER JOIN roles r ON vi.selected_role_id = r.id
  WHERE r.is_active = false;

  IF referenced_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % vendor(s) using inactive roles. These will be updated to NULL or a default role.', referenced_count;
    
    -- Update vendor_identity to set selected_role_id to NULL for inactive roles
    -- Or you could update to a default active role if preferred
    UPDATE vendor_identity vi
    SET selected_role_id = NULL,
        updated_at = NOW()
    FROM roles r
    WHERE vi.selected_role_id = r.id
      AND r.is_active = false;
    
    RAISE NOTICE 'Updated % vendor(s) to have NULL selected_role_id', referenced_count;
  END IF;
END $$;

-- Check if any inactive roles are referenced by vendor_onboarding_applications
-- Since role_id has NOT NULL constraint, we need to either:
-- 1. Find a replacement active role, or
-- 2. Delete the orphaned applications
DO $$
DECLARE
  referenced_count INTEGER;
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO referenced_count
  FROM vendor_onboarding_applications voa
  INNER JOIN roles r ON voa.role_id = r.id
  WHERE r.is_active = false;

  IF referenced_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % onboarding application(s) using inactive roles.', referenced_count;
    RAISE NOTICE 'These applications will be deleted as they reference inactive roles.';
    
    -- Delete onboarding applications that reference inactive roles
    -- These are likely incomplete/old applications
    DELETE FROM vendor_onboarding_applications voa
    WHERE EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = voa.role_id
        AND r.is_active = false
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % onboarding application(s) that referenced inactive roles', deleted_count;
  END IF;
END $$;

-- Check if any inactive roles are referenced by role_permissions
-- (This should be safe to delete as permissions are tied to roles)
DO $$
DECLARE
  perm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO perm_count
  FROM role_permissions rp
  INNER JOIN roles r ON rp.role_id = r.id
  WHERE r.is_active = false;

  IF perm_count > 0 THEN
    RAISE NOTICE 'Found % permissions for inactive roles. These will be deleted.', perm_count;
    
    -- Delete permissions for inactive roles
    DELETE FROM role_permissions rp
    WHERE EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = rp.role_id
        AND r.is_active = false
    );
    
    RAISE NOTICE 'Deleted % permissions for inactive roles', perm_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Delete inactive roles
-- ============================================================================

-- Delete all inactive roles
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Count inactive roles before deletion
  SELECT COUNT(*) INTO deleted_count
  FROM roles
  WHERE is_active = false;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Deleting % inactive role(s)...', deleted_count;
    
    -- Delete inactive roles
    DELETE FROM roles
    WHERE is_active = false;
    
    RAISE NOTICE 'Successfully deleted % inactive role(s)', deleted_count;
  ELSE
    RAISE NOTICE 'No inactive roles found to delete';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify deletion
-- ============================================================================

-- Verify: Should show 0 inactive roles
DO $$
DECLARE
  inactive_count INTEGER;
  active_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM roles;
  SELECT COUNT(*) INTO active_count FROM roles WHERE is_active = true;
  SELECT COUNT(*) INTO inactive_count FROM roles WHERE is_active = false;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE '  Total Roles: %', total_count;
  RAISE NOTICE '  Active Roles: %', active_count;
  RAISE NOTICE '  Inactive Roles: %', inactive_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Count roles
-- SELECT 
--   COUNT(*) as total_roles,
--   COUNT(*) FILTER (WHERE is_active = true) as active_roles,
--   COUNT(*) FILTER (WHERE is_active = false) as inactive_roles
-- FROM roles;

-- List all remaining roles
-- SELECT name, display_name, customer_service, is_active
-- FROM roles
-- ORDER BY is_active DESC, customer_service, name;

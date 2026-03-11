-- ============================================================================
-- MIGRATION 251: PERMANENTLY DELETE INACTIVE ROLES
-- ============================================================================
-- Date: 2026-01-31
-- Purpose: Permanently remove all inactive roles from catalog/DB (keep only active)
-- Run after 250_role_cleanup_canonical_24.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Clear references to inactive roles
-- ============================================================================

-- vendor_identity.selected_role_id
UPDATE vendor_identity vi
SET selected_role_id = NULL, updated_at = NOW()
FROM roles r
WHERE vi.selected_role_id = r.id AND r.is_active = false;

-- vendor_onboarding_applications (role_id)
DELETE FROM vendor_onboarding_applications voa
WHERE EXISTS (
  SELECT 1 FROM roles r
  WHERE r.id = voa.role_id AND r.is_active = false
);

-- role_permissions
DELETE FROM role_permissions rp
WHERE EXISTS (
  SELECT 1 FROM roles r
  WHERE r.id = rp.role_id AND r.is_active = false
);

-- ============================================================================
-- STEP 2: Permanently delete inactive roles
-- ============================================================================

DELETE FROM roles WHERE is_active = false;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM roles;
  RAISE NOTICE 'Permanent delete complete. Total roles remaining: %', total_count;
END $$;

COMMIT;

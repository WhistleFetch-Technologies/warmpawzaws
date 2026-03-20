-- ============================================================================
-- Migration 534: Unlock REJECTED applications to allow resubmission
-- ============================================================================
-- Purpose: Unlock any REJECTED applications that are still locked, allowing
--          vendors to resubmit their applications after rejection.
--          This is a data fix migration to correct applications that were
--          rejected before the code fix that unlocks them automatically.
-- Date: 2026-02-03
-- ============================================================================

DO $$
DECLARE
  unlocked_count INTEGER;
BEGIN
  -- Unlock all REJECTED applications that are currently locked
  UPDATE vendor_onboarding_applications
  SET 
    is_locked = false,
    locked_at = NULL,
    updated_at = NOW()
  WHERE 
    status = 'REJECTED' 
    AND (is_locked = true OR locked_at IS NOT NULL);
  
  GET DIAGNOSTICS unlocked_count = ROW_COUNT;
  
  IF unlocked_count > 0 THEN
    RAISE NOTICE 'Unlocked % REJECTED application(s) to allow resubmission', unlocked_count;
  ELSE
    RAISE NOTICE 'No locked REJECTED applications found';
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION 534
-- ============================================================================

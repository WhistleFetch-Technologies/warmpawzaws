-- ============================================================================
-- MIGRATION 1131: Fix medical_records immutability trigger defect
-- ============================================================================
-- Date: 2026-11-11
-- Environment target: DEV first (apply only with explicit approval)
--
-- Business decision (approved):
--   Customers must be allowed to edit their own uploaded medical records
--   after creation. Authorization remains enforced in application code
--   (authentication mandatory; ownership checks; cross-customer → 404;
--   admin behaviour unchanged).
--
-- Defect:
--   public.prevent_medical_record_updates() references OLD.is_immutable, but
--   public.medical_records has no is_immutable column. The enabled BEFORE UPDATE
--   trigger therefore raises PostgreSQL SQLSTATE 42703
--   (record "old" has no field "is_immutable") and legitimate UPDATEs return HTTP 500.
--
-- Remediation:
--   Drop the broken immutability trigger and function only.
--   Preserve public.trigger_update_medical_records_updated_at.
--   Do NOT add is_immutable.
--   Do NOT modify prescriptions triggers/functions (separate scope).
--   Do NOT UPDATE/DELETE medical_records row data.
--
-- Idempotent: safe to re-run (IF EXISTS).
-- Forward-fix recovery: do not recreate the defective OLD.is_immutable function.
--   If a future immutability policy is required, design a new control that matches
--   the live schema and product rules, then ship a new forward migration.
-- ============================================================================

BEGIN;

-- Remove broken BEFORE UPDATE immutability guard (trigger first, then function).
DROP TRIGGER IF EXISTS trigger_prevent_medical_record_updates
  ON public.medical_records;

DROP FUNCTION IF EXISTS public.prevent_medical_record_updates();

-- Explicit non-change (documentation only):
--   public.trigger_update_medical_records_updated_at must remain enabled.
--   This migration does not DROP or REPLACE that trigger or
--   public.update_prescriptions_updated_at().

COMMIT;

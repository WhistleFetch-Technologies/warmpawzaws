-- ============================================================================
-- MIGRATION 1084: Drop unused vendors.pay_bill_enabled column
-- ============================================================================
-- Purpose: Warmpawz Pay eligibility no longer uses pay_bill_enabled.
--          Admin catalogue publish_status is the Pay Bill enablement switch.
-- Idempotent: safe to re-run (checks column existence before DROP)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'pay_bill_enabled'
  ) THEN
    ALTER TABLE public.vendors DROP COLUMN pay_bill_enabled;
    RAISE NOTICE '1084: dropped vendors.pay_bill_enabled';
  ELSE
    RAISE NOTICE '1084: vendors.pay_bill_enabled already absent — skipping';
  END IF;
END $$;

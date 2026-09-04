-- ============================================================================
-- MIGRATION 1107: Ensure settlements.settlement_breakup exists (prod gap from 029)
-- ============================================================================
-- Admin WPay payments list selects s.settlement_breakup. Prod is missing the column
-- (migration 029 never applied there), causing 500 VALIDATION_ERROR / Internal server error.
-- Idempotent + additive only.
-- ============================================================================

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS settlement_breakup JSONB DEFAULT NULL;

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS tier_deduction_amount NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN settlements.settlement_breakup IS
  'Detailed breakup of settlement calculation with explanations';

COMMENT ON COLUMN settlements.tier_deduction_amount IS
  'Amount deducted for tier upgrade recovery';

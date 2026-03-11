-- ============================================================================
-- MIGRATION 612: Add onboarding_forms.sections column (from inline code changes)
-- Date: 2026-02-28
-- Purpose: Migrate inline ALTER TABLE statements from onboarding-form-management.ts to proper migration
-- ============================================================================
-- This migration adds the sections column that was being added inline in the code
-- Source: backend/lambda/src/endpoints/onboarding-form-management.ts (line 695)
-- ============================================================================

DO $$
BEGIN
  -- Add sections column to onboarding_forms table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_forms' AND column_name = 'sections') THEN
    ALTER TABLE onboarding_forms ADD COLUMN sections JSONB;
    COMMENT ON COLUMN onboarding_forms.sections IS 'Form sections configuration in JSON format';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_forms_sections ON onboarding_forms USING gin(sections) WHERE sections IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

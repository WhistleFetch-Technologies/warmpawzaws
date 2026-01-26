-- ============================================================================
-- Migration 314: Add prescription_date column to prescriptions table with DEFAULT
-- Date: 2026-01-23
-- Purpose: Add prescription_date column to prescriptions table with DEFAULT CURRENT_DATE
--          to prevent NOT NULL constraint violations
-- ============================================================================

BEGIN;

-- Add prescription_date column if it doesn't exist
DO $$
BEGIN
  -- Check if column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'prescription_date'
  ) THEN
    -- Add column with DEFAULT CURRENT_DATE
    ALTER TABLE prescriptions 
    ADD COLUMN prescription_date DATE NOT NULL DEFAULT CURRENT_DATE;
    
    -- Update existing rows to have current date if they're null (shouldn't happen but safety)
    UPDATE prescriptions 
    SET prescription_date = CURRENT_DATE 
    WHERE prescription_date IS NULL;
    
    RAISE NOTICE 'Added prescription_date column to prescriptions table with DEFAULT CURRENT_DATE';
  ELSE
    -- Column exists, but might not have default - add it
    ALTER TABLE prescriptions 
    ALTER COLUMN prescription_date SET DEFAULT CURRENT_DATE;
    
    -- If column is nullable, make it NOT NULL with default
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'prescriptions' 
      AND column_name = 'prescription_date'
      AND is_nullable = 'YES'
    ) THEN
      -- First update any NULL values
      UPDATE prescriptions 
      SET prescription_date = CURRENT_DATE 
      WHERE prescription_date IS NULL;
      
      -- Then make it NOT NULL
      ALTER TABLE prescriptions 
      ALTER COLUMN prescription_date SET NOT NULL;
    END IF;
    
    RAISE NOTICE 'Updated prescription_date column to have DEFAULT CURRENT_DATE';
  END IF;
END $$;

-- Add index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescription_date ON prescriptions(prescription_date DESC);

-- Add comment for documentation
COMMENT ON COLUMN prescriptions.prescription_date IS 'Date when prescription was issued. Defaults to current date if not provided.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY (Run after migration)
-- ============================================================================
-- 
-- Verify column exists with default:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'prescriptions' 
-- AND column_name = 'prescription_date';
--
-- Expected result:
-- column_name: prescription_date
-- data_type: date
-- column_default: CURRENT_DATE
-- is_nullable: NO
-- ============================================================================

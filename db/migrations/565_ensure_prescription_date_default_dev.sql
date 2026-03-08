-- ============================================================================
-- Migration 565: Ensure prescription_date has DEFAULT CURRENT_DATE in DEV RDS
-- Date: 2026-02-28
-- Purpose: Ensure prescription_date column has DEFAULT CURRENT_DATE to prevent NOT NULL constraint violations
-- ============================================================================
-- This migration ensures the prescription_date column has a default value.
-- If the column doesn't exist, it will be created with DEFAULT CURRENT_DATE.
-- If it exists but doesn't have a default, the default will be added.
-- ============================================================================

DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' AND column_name = 'prescription_date'
    ) THEN
        -- Add column with DEFAULT CURRENT_DATE
        ALTER TABLE prescriptions 
        ADD COLUMN prescription_date DATE NOT NULL DEFAULT CURRENT_DATE;
        
        -- Update any existing NULL values (safety check)
        UPDATE prescriptions 
        SET prescription_date = CURRENT_DATE 
        WHERE prescription_date IS NULL;
        
        RAISE NOTICE 'Added prescription_date column with DEFAULT CURRENT_DATE';
    ELSE
        -- Column exists - ensure it has a default value
        -- First, update any NULL values
        UPDATE prescriptions 
        SET prescription_date = COALESCE(prescription_date, CURRENT_DATE)
        WHERE prescription_date IS NULL;
        
        -- Set default if it doesn't exist
        ALTER TABLE prescriptions 
        ALTER COLUMN prescription_date SET DEFAULT CURRENT_DATE;
        
        -- If column is nullable, make it NOT NULL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'prescriptions' 
            AND column_name = 'prescription_date'
            AND is_nullable = 'YES'
        ) THEN
            ALTER TABLE prescriptions 
            ALTER COLUMN prescription_date SET NOT NULL;
        END IF;
        
        RAISE NOTICE 'Updated prescription_date column to have DEFAULT CURRENT_DATE';
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescription_date ON prescriptions(prescription_date DESC);

-- Add comment
COMMENT ON COLUMN prescriptions.prescription_date IS 'Date when prescription was issued. Defaults to current date if not provided.';

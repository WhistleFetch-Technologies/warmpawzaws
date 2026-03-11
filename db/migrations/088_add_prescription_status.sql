-- ============================================================================
-- MIGRATION 088: Add status column to prescriptions table
-- ============================================================================
-- Date: 2026-01-19
-- Purpose: Add draft/published status support for prescriptions
-- ============================================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE prescriptions 
        ADD COLUMN status VARCHAR(20) DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'cancelled'));
        
        COMMENT ON COLUMN prescriptions.status IS 'Prescription status: draft (editable), published (visible to customer, immutable), cancelled';
    END IF;
END $$;

-- Add doctor_name column if it doesn't exist (for display)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' 
        AND column_name = 'doctor_name'
    ) THEN
        ALTER TABLE prescriptions 
        ADD COLUMN doctor_name VARCHAR(255);
        
        COMMENT ON COLUMN prescriptions.doctor_name IS 'Name of the prescribing doctor/vet';
    END IF;
END $$;

-- Add diagnosis column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' 
        AND column_name = 'diagnosis'
    ) THEN
        ALTER TABLE prescriptions 
        ADD COLUMN diagnosis TEXT;
        
        COMMENT ON COLUMN prescriptions.diagnosis IS 'Diagnosis or condition for the prescription';
    END IF;
END $$;

-- Add follow_up_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' 
        AND column_name = 'follow_up_date'
    ) THEN
        ALTER TABLE prescriptions 
        ADD COLUMN follow_up_date DATE;
        
        COMMENT ON COLUMN prescriptions.follow_up_date IS 'Recommended follow-up date';
    END IF;
END $$;

-- Add follow_up_notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' 
        AND column_name = 'follow_up_notes'
    ) THEN
        ALTER TABLE prescriptions 
        ADD COLUMN follow_up_notes TEXT;
        
        COMMENT ON COLUMN prescriptions.follow_up_notes IS 'Notes for follow-up appointment';
    END IF;
END $$;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- Update existing prescriptions to have 'published' status if status is null
UPDATE prescriptions SET status = 'published' WHERE status IS NULL;

COMMENT ON TABLE prescriptions IS 'Prescriptions with draft/published support. Published prescriptions are immutable.';

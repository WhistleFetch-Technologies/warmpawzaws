-- ============================================================================
-- Migration 564: Add next_follow_up_date column to prescriptions table
-- Date: 2026-02-28
-- Purpose: Add missing next_follow_up_date column to prescriptions table for DEV RDS
-- ============================================================================
-- This migration adds the next_follow_up_date DATE column to the prescriptions table
-- if it doesn't already exist. This column is used for storing the next follow-up
-- appointment date for the prescription.
-- ============================================================================

-- Add next_follow_up_date column to prescriptions (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' AND column_name = 'next_follow_up_date'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN next_follow_up_date DATE;
        COMMENT ON COLUMN prescriptions.next_follow_up_date IS 'Next follow-up appointment date for the prescription';
    END IF;
END $$;

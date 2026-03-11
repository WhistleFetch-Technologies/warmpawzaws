-- ============================================================================
-- Migration 563: Add general_notes column to prescriptions table
-- Date: 2026-02-28
-- Purpose: Add missing general_notes column to prescriptions table for DEV RDS
-- ============================================================================
-- This migration adds the general_notes TEXT column to the prescriptions table
-- if it doesn't already exist. This column is used for storing general notes
-- about the prescription.
-- ============================================================================

-- Add general_notes column to prescriptions (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prescriptions' AND column_name = 'general_notes'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN general_notes TEXT;
        COMMENT ON COLUMN prescriptions.general_notes IS 'General notes about the prescription';
    END IF;
END $$;

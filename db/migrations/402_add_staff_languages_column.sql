-- ============================================================================
-- Migration: 402_add_staff_languages_column.sql
-- Description: Add languages column to staff table for multilingual support
-- Date: 2025-01-27
-- ============================================================================

-- Add languages column (stored as TEXT[] array of language codes/names)
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN staff.languages IS 'Languages spoken by staff member (e.g., English, Hindi, Kannada)';

-- Create index for language-based filtering
CREATE INDEX IF NOT EXISTS idx_staff_languages 
ON staff USING GIN(languages);

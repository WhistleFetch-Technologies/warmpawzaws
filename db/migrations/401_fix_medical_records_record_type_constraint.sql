-- ============================================================================
-- MIGRATION 401: Fix medical_records record_type constraint to include 'prescription'
-- ============================================================================
-- Date: 2026-01-23
-- Purpose: Update check constraint to allow 'prescription' as a valid record_type
-- ============================================================================

-- Drop the old constraint if it exists (handle different constraint names)
DO $$
BEGIN
    -- Try to drop constraint with different possible names
    ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;
    ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check1;
    ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check2;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might not exist or have different name, continue
        NULL;
END $$;

-- Add new constraint that includes 'prescription' and all other valid types
-- This covers all the types from different migrations
ALTER TABLE medical_records 
ADD CONSTRAINT medical_records_record_type_check 
CHECK (record_type IN (
    'prescription',           -- ✅ NEW: Added for prescription uploads
    'diagnostic_report',      -- From migration 100
    'lab_result',             -- From migration 100
    'vaccination',            -- Common across migrations
    'consultation_notes',     -- From migration 100
    'surgery_notes',          -- From migration 100
    'diet_plan',              -- From migration 100
    'imaging',                -- From migration 100
    'checkup',                -- From migrations 007, 008, 057
    'surgery',                -- From migrations 007, 008, 057
    'treatment',              -- From migrations 007, 057
    'diagnostic',             -- From migrations 007, 008, 057
    'illness',                -- From migrations 007, 008
    'injury',                 -- From migrations 007, 008
    'follow_up',              -- From migration 007
    'other'                   -- Common across migrations
));

COMMENT ON CONSTRAINT medical_records_record_type_check ON medical_records IS 
'Updated constraint to include prescription and all valid record types from various migrations';

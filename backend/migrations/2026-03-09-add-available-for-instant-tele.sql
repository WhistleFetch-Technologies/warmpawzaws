-- ============================================================================
-- MIGRATION: Add available_for_instant_tele column to vendors table
-- ============================================================================
-- Date: 2026-03-09
-- Purpose: Add available_for_instant_tele boolean column to vendors table
-- Impact: Enables instant tele consultation availability tracking
-- Rollback: See rollback section at bottom
-- ============================================================================

-- ============================================================================
-- STEP 1: Add the column
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- If column already exists, this will fail - check first or handle the error
-- ============================================================================

ALTER TABLE vendors 
ADD COLUMN available_for_instant_tele BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Add comment to document the column
-- ============================================================================

COMMENT ON COLUMN vendors.available_for_instant_tele IS 
'Indicates whether the vendor is currently available for instant tele consultations. 
Set to true when vendor is online and ready, false when busy or offline.';

-- ============================================================================
-- STEP 3: Verification Query (run separately to verify)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele';
--
-- SELECT COUNT(*) as total_vendors, 
--        COUNT(*) FILTER (WHERE available_for_instant_tele = true) as available_count
-- FROM vendors;

-- ============================================================================
-- ROLLBACK SCRIPT (Run this if you need to undo the migration)
-- ============================================================================
/*
BEGIN;

-- Remove the column
ALTER TABLE vendors DROP COLUMN IF EXISTS available_for_instant_tele;

COMMIT;
*/

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
/*
After running this migration:

1. The available_for_instant_tele column is now available in the vendors table
2. Default value is false (vendors are not available by default)
3. Update vendor profiles to set this flag when they go online/offline
4. The instant tele endpoints can now check this field before allowing bookings
5. Consider adding an index if you frequently query by this column:
   CREATE INDEX idx_vendors_available_instant_tele ON vendors(available_for_instant_tele) 
   WHERE available_for_instant_tele = true;
*/

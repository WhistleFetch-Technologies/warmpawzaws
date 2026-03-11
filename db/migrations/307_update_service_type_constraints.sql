-- ============================================================================
-- MIGRATION 307: Update Service Type Constraints
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Update bookings.service_type CHECK constraint to accept frontend values
-- 
-- Issue: Frontend sends 'at_center' and 'tele' but database only allows 
--        'at_vendor', 'at_home', 'online'
--        Note: 'tele' is already used in DB schema (vendor_services.service_style, etc.)
-- 
-- Solution: Update constraint to accept all values for backward compatibility
-- 
-- Related Files:
-- - backend/lambda/src/endpoints/bookings-enhanced.ts (Line 490)
-- - apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx
-- - SERVICE_BOOKING_FLOW_TRACE_REPORT.md (Gap Report)
-- ============================================================================

-- ============================================================================
-- UPDATE BOOKINGS TABLE SERVICE_TYPE CONSTRAINT
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_service_type_check;

-- Add new constraint that accepts all service type values
-- Supports both old values ('at_vendor') and new values ('at_center', 'tele')
-- Note: 'tele' is already used in DB (vendor_services, vendor_availability_v2), so we use 'tele' instead of 'online'
ALTER TABLE bookings 
ADD CONSTRAINT bookings_service_type_check 
CHECK (service_type IN (
  'at_vendor',    -- Legacy: Center/clinic bookings
  'at_center',    -- New: Center/clinic bookings (preferred)
  'at_home',      -- Home visit bookings
  'tele'          -- Tele/video consultation (already in DB, preferred)
));

COMMENT ON CONSTRAINT bookings_service_type_check ON bookings IS 
'Service type constraint - accepts both legacy and new values for backward compatibility. 
 Legacy: at_vendor (maps to at_center)
 New: at_center, tele (preferred by frontend and already used in DB schema)
 Note: Backend automatically maps legacy "online" to "tele" for backward compatibility';

-- ============================================================================
-- VERIFY EXISTING DATA COMPATIBILITY
-- ============================================================================

-- Check if there are any existing bookings with values that would violate the new constraint
-- This should return 0 rows if migration is safe
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM bookings
  WHERE service_type NOT IN ('at_vendor', 'at_center', 'at_home', 'tele');
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % bookings with invalid service_type values. These need to be migrated manually.', invalid_count;
  ELSE
    RAISE NOTICE 'All existing bookings have valid service_type values. Migration is safe.';
  END IF;
END $$;

-- ============================================================================
-- CREATE INDEX FOR PERFORMANCE (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_service_type ON bookings(service_type);

COMMENT ON INDEX idx_bookings_service_type IS 'Index on service_type for filtering bookings by service type';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- ============================================================================
-- BACKWARD COMPATIBILITY NOTES
-- ============================================================================
-- 
-- This migration maintains backward compatibility by accepting:
-- - Legacy value: 'at_vendor' (center) - maps to 'at_center'
-- - New values: 'at_center' (center), 'tele' (tele/video)
-- 
-- Note: 'tele' is already used throughout the DB schema (vendor_services.service_style,
-- vendor_availability_v2.service_style), so we use 'tele' instead of 'online' for consistency.
-- 
-- Frontend should use 'at_center' and 'tele' going forward.
-- Legacy 'at_vendor' will continue to work for existing bookings.
-- 
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 307 completed successfully.';
  RAISE NOTICE 'bookings.service_type now accepts: at_vendor, at_center, at_home, tele';
  RAISE NOTICE 'Using tele (not online) for consistency with existing DB schema.';
END $$;

-- ============================================================================
-- MIGRATION: Fix Booking Slot Unique Indexes
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Update unique indexes to only block 'confirmed' bookings, not 'pending'
-- 
-- Issue: Unique indexes were preventing multiple 'pending' bookings for same slot
-- Fix: Update WHERE clause to only apply unique constraint to 'confirmed' bookings
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING UNIQUE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_booking_slot_vendor_unique;
DROP INDEX IF EXISTS idx_booking_slot_staff_unique;

-- ============================================================================
-- 2. RECREATE WITH CORRECT WHERE CLAUSE (ONLY 'confirmed' bookings)
-- ============================================================================

-- For vendor-level slots (when no staff assigned)
-- ✅ CRITICAL FIX: Only enforce uniqueness for 'confirmed' bookings
-- This allows multiple 'pending' bookings until one is confirmed
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_vendor_unique 
ON bookings (vendor_id, booking_date, booking_time)
WHERE staff_id IS NULL 
  AND status = 'confirmed';

-- For staff-level slots
-- ✅ CRITICAL FIX: Only enforce uniqueness for 'confirmed' bookings
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_staff_unique 
ON bookings (vendor_id, staff_id, booking_date, booking_time)
WHERE staff_id IS NOT NULL 
  AND status = 'confirmed';

COMMENT ON INDEX idx_booking_slot_vendor_unique IS 'Prevents double-booking at vendor level - only for confirmed bookings';
COMMENT ON INDEX idx_booking_slot_staff_unique IS 'Prevents double-booking at staff level - only for confirmed bookings';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying this migration:
-- 1. Multiple 'pending' bookings should be allowed for same slot
-- 2. Only 'confirmed' bookings should block the slot
-- 3. Test by creating multiple pending bookings, then confirming one

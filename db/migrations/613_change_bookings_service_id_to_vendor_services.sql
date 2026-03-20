-- ============================================================================
-- MIGRATION 613: Change bookings.service_id FK to reference vendor_services.id
-- ============================================================================
-- Date: 2026-03-13
-- Purpose: Fix FK constraint issue - bookings.service_id should reference
--          vendor_services.id (the actual service instance) instead of
--          services.id (which only exists for custom services)
-- 
-- This allows bookings to work for both:
-- - Catalog services (vendor_services.service_id → service_catalog.id)
-- - Custom services (vendor_services.service_id → services.id)
-- ============================================================================

-- Step 1: Drop the old FK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_service_id_fkey'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_service_id_fkey;
    RAISE NOTICE 'Dropped old FK constraint: bookings_service_id_fkey';
  ELSE
    RAISE NOTICE 'FK constraint bookings_service_id_fkey does not exist, skipping drop';
  END IF;
END $$;

-- Step 2: Update existing bookings.service_id to point to vendor_services.id
-- This is a data migration - we need to find the vendor_services.id that matches
-- the current bookings.service_id
UPDATE bookings b
SET service_id = vs.id
FROM vendor_services vs
WHERE b.service_id = vs.service_id
  AND b.vendor_id = vs.vendor_id
  AND b.service_id IS NOT NULL;

-- Step 3: For bookings that couldn't be matched (orphaned), try to find by service_catalog
-- If booking.service_id exists in service_catalog, find vendor_services that reference it
UPDATE bookings b
SET service_id = vs.id
FROM vendor_services vs
INNER JOIN service_catalog sc ON vs.service_id = sc.id
WHERE b.service_id = sc.id
  AND b.vendor_id = vs.vendor_id
  AND b.service_id NOT IN (SELECT id FROM vendor_services);

-- Step 4: Add new FK constraint to vendor_services.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_service_id_vendor_services_fkey'
  ) THEN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_service_id_vendor_services_fkey 
    FOREIGN KEY (service_id) REFERENCES vendor_services(id);
    RAISE NOTICE 'Added new FK constraint: bookings_service_id_vendor_services_fkey';
  ELSE
    RAISE NOTICE 'FK constraint bookings_service_id_vendor_services_fkey already exists';
  END IF;
END $$;

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_service_id_vendor_services 
ON bookings(service_id);

COMMENT ON CONSTRAINT bookings_service_id_vendor_services_fkey ON bookings IS 
'Foreign key to vendor_services.id - references the actual service instance being booked (works for both catalog and custom services)';

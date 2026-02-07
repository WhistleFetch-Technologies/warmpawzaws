-- Migration 502: Add pet_id column and booking_services table
-- ================================================================
-- This migration:
-- 1. Adds pet_id column to bookings table (proper FK instead of notes field)
-- 2. Creates booking_services junction table for multi-service bookings
-- 3. Adds selected_services JSONB column for simpler storage option
-- ================================================================

-- Step 1: Add pet_id column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id);

-- Step 2: Migrate existing pet IDs from notes field
-- Use substring with regexp to extract UUID
UPDATE bookings 
SET pet_id = CAST(
  substring(notes from 'Pet ID:\s*([a-f0-9-]{36})') AS UUID
)
WHERE pet_id IS NULL 
  AND notes ~ 'Pet ID:\s*[a-f0-9-]{36}';

-- Step 3: Add selected_services JSONB column for storing multiple services
-- Format: [{ id, name, price, duration, quantity }]
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;

-- Step 4: Create booking_services junction table (for normalized storage)
CREATE TABLE IF NOT EXISTS booking_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id UUID REFERENCES vendor_services(id),
    service_name VARCHAR(255) NOT NULL,
    service_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    service_duration INTEGER DEFAULT 30, -- minutes
    quantity INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pet_id ON bookings(pet_id);
CREATE INDEX IF NOT EXISTS idx_bookings_selected_services ON bookings USING gin(selected_services);

-- Step 6: Add duration_minutes if not exists (redundant with service duration but useful for total)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER;

-- Step 7: Update total_duration_minutes from selected_services
-- This will be calculated on booking creation

-- Log the changes
DO $$
DECLARE
  bookings_with_pet_id INTEGER;
  total_bookings INTEGER;
BEGIN
  SELECT COUNT(*) INTO bookings_with_pet_id FROM bookings WHERE pet_id IS NOT NULL;
  SELECT COUNT(*) INTO total_bookings FROM bookings;
  RAISE NOTICE 'Migration complete: % bookings with pet_id out of % total', bookings_with_pet_id, total_bookings;
END $$;

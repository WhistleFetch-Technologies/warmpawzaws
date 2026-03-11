-- ============================================================================
-- MIGRATION 541: ADD MISSING BOOKING COLUMNS FOR PROD
-- ============================================================================
-- Date: 2026-02-21
-- Purpose: Add all missing columns to bookings table that are used by bookings-enhanced.ts
--          This ensures prod matches dev schema
-- ============================================================================

-- Add customer_phone column (from migration 300)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
COMMENT ON COLUMN bookings.customer_phone IS 'Customer phone number - denormalized from customers table for performance';

-- Add duration_minutes column (from migration 312)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
COMMENT ON COLUMN bookings.duration_minutes IS 'Total duration in minutes for booking. For multi-service bookings, this is the sum of all service durations.';

-- Add total_duration_minutes column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER;
COMMENT ON COLUMN bookings.total_duration_minutes IS 'Total duration in minutes including all services';

-- Add pet_id column (from migration 502)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id);
COMMENT ON COLUMN bookings.pet_id IS 'Pet ID for this booking (proper FK instead of notes field)';

-- Add selected_services JSONB column (from migration 502)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN bookings.selected_services IS 'Array of selected services: [{ id, name, price, duration, quantity }]';

-- Add subscription_id column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_id UUID;
COMMENT ON COLUMN bookings.subscription_id IS 'Subscription used for this booking (if applicable)';

-- Add subscription_booking column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_booking BOOLEAN DEFAULT false;
COMMENT ON COLUMN bookings.subscription_booking IS 'Flag indicating if this is a subscription booking';

-- Add room_id column (for boarding/resort bookings)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id UUID;
COMMENT ON COLUMN bookings.room_id IS 'Room ID for boarding/resort bookings';

-- Add package_purchase_id column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_purchase_id UUID;
COMMENT ON COLUMN bookings.package_purchase_id IS 'Package purchase ID used for this booking';

-- Add is_package_session column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_package_session BOOLEAN DEFAULT false;
COMMENT ON COLUMN bookings.is_package_session IS 'Flag indicating if this is a package session booking';

-- Add package_session_number column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_session_number INTEGER;
COMMENT ON COLUMN bookings.package_session_number IS 'Session number within the package';

-- Add estimated_arrival column (for home services with commute time)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ;
COMMENT ON COLUMN bookings.estimated_arrival IS 'Estimated arrival time for home service bookings (includes commute time)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_duration_minutes ON bookings(duration_minutes) WHERE duration_minutes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_pet_id ON bookings(pet_id) WHERE pet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_selected_services ON bookings USING gin(selected_services);
CREATE INDEX IF NOT EXISTS idx_bookings_subscription_id ON bookings(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_package_purchase_id ON bookings(package_purchase_id) WHERE package_purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id) WHERE room_id IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

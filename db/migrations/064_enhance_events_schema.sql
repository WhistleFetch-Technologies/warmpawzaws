-- ============================================================================
-- MIGRATION 064: Enhance Events Schema for Complete Event Management
-- ============================================================================
-- Date: 2025-01-13
-- Purpose: Add comprehensive event fields (inclusions, exclusions, T&C, venue details)
-- ============================================================================

-- Enhance events table with comprehensive fields
DO $$ BEGIN
    -- Maximum bookings (separate from max_attendees for clarity)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='max_bookings') THEN
        ALTER TABLE events ADD COLUMN max_bookings INTEGER;
    END IF;
    
    -- Price per booking (clearer than fees)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='price_per_booking') THEN
        ALTER TABLE events ADD COLUMN price_per_booking NUMERIC(10, 2);
    END IF;
    
    -- Inclusions (what's included in the event)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='inclusions') THEN
        ALTER TABLE events ADD COLUMN inclusions TEXT[] DEFAULT '{}';
    END IF;
    
    -- Exclusions (what's not included)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='exclusions') THEN
        ALTER TABLE events ADD COLUMN exclusions TEXT[] DEFAULT '{}';
    END IF;
    
    -- Terms and Conditions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='terms_and_conditions') THEN
        ALTER TABLE events ADD COLUMN terms_and_conditions TEXT;
    END IF;
    
    -- Venue details (enhanced structure)
    -- venue JSONB already exists, but we'll ensure it has proper structure
    -- Expected structure: { name, address, city, state, pincode, coordinates: {lat, lng}, capacity, facilities: [] }
    
    -- Registration rules (JSONB for flexible rules)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='registration_rules') THEN
        ALTER TABLE events ADD COLUMN registration_rules JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Cancellation policy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='cancellation_policy') THEN
        ALTER TABLE events ADD COLUMN cancellation_policy TEXT;
    END IF;
    
    -- Refund policy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='refund_policy') THEN
        ALTER TABLE events ADD COLUMN refund_policy TEXT;
    END IF;
    
    COMMENT ON COLUMN events.max_bookings IS 'Maximum number of bookings allowed';
    COMMENT ON COLUMN events.price_per_booking IS 'Price per booking/registration';
    COMMENT ON COLUMN events.inclusions IS 'What is included in the event (array of strings)';
    COMMENT ON COLUMN events.exclusions IS 'What is not included (array of strings)';
    COMMENT ON COLUMN events.terms_and_conditions IS 'Terms and conditions for the event';
    COMMENT ON COLUMN events.registration_rules IS 'Registration rules (JSONB: {min_age, max_age, pet_restrictions, etc.})';
    COMMENT ON COLUMN events.cancellation_policy IS 'Cancellation policy';
    COMMENT ON COLUMN events.refund_policy IS 'Refund policy';
END $$;

-- Update existing events: Copy fees to price_per_booking if not set
UPDATE events 
SET price_per_booking = fees 
WHERE price_per_booking IS NULL AND fees IS NOT NULL;

-- Update existing events: Copy max_attendees to max_bookings if not set
UPDATE events 
SET max_bookings = max_attendees 
WHERE max_bookings IS NULL AND max_attendees IS NOT NULL;

-- Ensure venue has proper structure for existing events
UPDATE events 
SET venue = jsonb_build_object(
    'address', COALESCE(venue->>'address', ''),
    'city', COALESCE(venue->>'city', ''),
    'state', COALESCE(venue->>'state', ''),
    'pincode', COALESCE(venue->>'pincode', ''),
    'coordinates', COALESCE(venue->'coordinates', '{}'::jsonb),
    'capacity', COALESCE((venue->>'capacity')::integer, max_attendees),
    'facilities', COALESCE(venue->'facilities', '[]'::jsonb)
)
WHERE venue IS NULL OR venue = '{}'::jsonb;

-- Migration: Add duration_minutes column to bookings table
-- Purpose: Store total duration for multi-service bookings
-- Date: 2026-01-23

-- Check if column exists, add if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'duration_minutes'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER;
        
        COMMENT ON COLUMN bookings.duration_minutes IS 
            'Total duration in minutes for booking. For multi-service bookings, this is the sum of all service durations.';
        
        -- Update existing bookings with default duration if service has duration
        UPDATE bookings b
        SET duration_minutes = COALESCE(
            (SELECT duration_minutes FROM services s WHERE s.id = b.service_id),
            60 -- Default 60 minutes if service duration not found
        )
        WHERE b.duration_minutes IS NULL;
        
        RAISE NOTICE 'Added duration_minutes column to bookings table';
    ELSE
        RAISE NOTICE 'duration_minutes column already exists in bookings table';
    END IF;
END $$;

-- Create index for duration queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_bookings_duration_minutes 
ON bookings(duration_minutes) 
WHERE duration_minutes IS NOT NULL;

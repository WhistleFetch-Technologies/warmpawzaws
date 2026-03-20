-- ============================================================================
-- MIGRATION 616: Add otp_verified_at column to bookings table
-- ============================================================================
-- Date: 2026-03-15
-- Purpose: Add otp_verified_at timestamp column to track when OTP was verified
-- ============================================================================

-- Add otp_verified_at column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'otp_verified_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN otp_verified_at TIMESTAMPTZ;
        RAISE NOTICE 'Added otp_verified_at column to bookings table';
    ELSE
        RAISE NOTICE 'otp_verified_at column already exists in bookings table';
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_otp_verified_at ON bookings(otp_verified_at) WHERE otp_verified_at IS NOT NULL;

COMMENT ON COLUMN bookings.otp_verified_at IS 'Timestamp when OTP was verified for the booking';

-- ============================================================================
-- MIGRATION 027: Booking Lifecycle OTP Columns
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Add OTP start/end columns and lifecycle tracking to bookings table
-- Migration: KV to SQL - Booking Lifecycle
-- ============================================================================

-- Add OTP start/end columns for service lifecycle
DO $$ BEGIN
    -- OTP Start (for service start verification)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_start_code') THEN
        ALTER TABLE bookings ADD COLUMN otp_start_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_start_verified') THEN
        ALTER TABLE bookings ADD COLUMN otp_start_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_start_attempts') THEN
        ALTER TABLE bookings ADD COLUMN otp_start_attempts INTEGER DEFAULT 0;
    END IF;
    
    -- OTP End (for service completion verification)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_end_code') THEN
        ALTER TABLE bookings ADD COLUMN otp_end_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_end_verified') THEN
        ALTER TABLE bookings ADD COLUMN otp_end_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='otp_end_attempts') THEN
        ALTER TABLE bookings ADD COLUMN otp_end_attempts INTEGER DEFAULT 0;
    END IF;
    
    -- Service lifecycle tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='started_at') THEN
        ALTER TABLE bookings ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    
    -- Earnings tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='earnings_realized') THEN
        ALTER TABLE bookings ADD COLUMN earnings_realized BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='earnings_amount') THEN
        ALTER TABLE bookings ADD COLUMN earnings_amount NUMERIC(10, 2);
    END IF;
    
    -- Settlement reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='settlement_id') THEN
        ALTER TABLE bookings ADD COLUMN settlement_id UUID REFERENCES settlements(id);
    END IF;
    
    COMMENT ON COLUMN bookings.otp_start_code IS 'OTP code for service start verification';
    COMMENT ON COLUMN bookings.otp_start_verified IS 'Whether start OTP has been verified';
    COMMENT ON COLUMN bookings.otp_start_attempts IS 'Number of failed start OTP attempts';
    COMMENT ON COLUMN bookings.otp_end_code IS 'OTP code for service completion verification';
    COMMENT ON COLUMN bookings.otp_end_verified IS 'Whether end OTP has been verified';
    COMMENT ON COLUMN bookings.otp_end_attempts IS 'Number of failed end OTP attempts';
    COMMENT ON COLUMN bookings.started_at IS 'When service actually started (after start OTP verification)';
    COMMENT ON COLUMN bookings.earnings_realized IS 'Whether earnings have been calculated and realized';
    COMMENT ON COLUMN bookings.earnings_amount IS 'Vendor earnings amount for this booking';
    COMMENT ON COLUMN bookings.settlement_id IS 'Reference to settlement record for this booking';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_otp_start_code ON bookings(otp_start_code) WHERE otp_start_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_otp_end_code ON bookings(otp_end_code) WHERE otp_end_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_settlement_id ON bookings(settlement_id) WHERE settlement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_earnings_realized ON bookings(earnings_realized) WHERE earnings_realized = true;


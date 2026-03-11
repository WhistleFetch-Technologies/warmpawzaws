-- ============================================================================
-- MIGRATION 006: TIMEZONE & TEMPORAL ENHANCEMENTS
-- ============================================================================
-- Date: 2026-01-03
-- Purpose: Add timezone-aware booking datetime and temporal business rules
--
-- Changes:
-- 1. Add booking_datetime TIMESTAMPTZ column
-- 2. Add vendor timezone tracking
-- 3. Add temporal business rule enforcement
-- 4. Add booking timeout cleanup function
-- ============================================================================

-- ============================================================================
-- 1. ADD TIMEZONE-AWARE BOOKING DATETIME
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_datetime TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_timezone TEXT DEFAULT 'Asia/Kolkata';

COMMENT ON COLUMN bookings.booking_datetime IS 'Combined date+time+timezone for accurate scheduling';
COMMENT ON COLUMN bookings.vendor_timezone IS 'Vendor timezone for correct time interpretation';

-- Create index for datetime queries
CREATE INDEX IF NOT EXISTS idx_bookings_datetime ON bookings(booking_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_datetime_vendor ON bookings(vendor_id, booking_datetime);

-- ============================================================================
-- 2. VENDOR TIMEZONE TRACKING
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
COMMENT ON COLUMN vendors.timezone IS 'Vendor operating timezone (e.g., Asia/Kolkata, Asia/Dubai)';

-- ============================================================================
-- 3. UPDATE VENDOR AVAILABILITY TO TIMEZONE-AWARE
-- ============================================================================

-- Note: Cannot directly convert TIME to TIMETZ, so we'll add new columns
ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS time_window_start_tz TIMETZ;
ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS time_window_end_tz TIMETZ;
ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS availability_timezone TEXT DEFAULT 'Asia/Kolkata';

COMMENT ON COLUMN vendor_availability_v2.time_window_start_tz IS 'Start time with timezone';
COMMENT ON COLUMN vendor_availability_v2.time_window_end_tz IS 'End time with timezone';

-- ============================================================================
-- 4. BOOKING CANCELLATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_cancellation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    
    -- Cancellation window (hours before appointment)
    cancellation_cutoff_hours INTEGER NOT NULL DEFAULT 24,
    
    -- Refund policy
    full_refund_before_hours INTEGER DEFAULT 48,
    partial_refund_before_hours INTEGER DEFAULT 24,
    partial_refund_percentage NUMERIC(5, 2) DEFAULT 50.00,
    no_refund_before_hours INTEGER DEFAULT 0,
    
    -- Reschedule policy
    reschedule_allowed BOOLEAN DEFAULT true,
    reschedule_cutoff_hours INTEGER DEFAULT 12,
    max_reschedules INTEGER DEFAULT 2,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, service_id)
);

CREATE INDEX idx_cancellation_rules_vendor ON booking_cancellation_rules(vendor_id);
CREATE INDEX idx_cancellation_rules_service ON booking_cancellation_rules(service_id);

COMMENT ON TABLE booking_cancellation_rules IS 'Defines cancellation and reschedule policies per vendor/service';

-- ============================================================================
-- 5. BOOKING TIMEOUT RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_timeout_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL UNIQUE,
    timeout_minutes INTEGER NOT NULL,
    status_to_cancel TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default timeout rules
INSERT INTO booking_timeout_config (config_name, timeout_minutes, status_to_cancel, description)
VALUES 
    ('pending_payment_timeout', 15, ARRAY['pending'], 'Cancel bookings pending payment for >15 minutes'),
    ('unconfirmed_timeout', 60, ARRAY['pending'], 'Cancel unconfirmed bookings after 1 hour'),
    ('payment_failed_cleanup', 1440, ARRAY['pending'], 'Clean up failed payments after 24 hours')
ON CONFLICT (config_name) DO NOTHING;

-- ============================================================================
-- 6. CLEANUP FUNCTION FOR PENDING BOOKINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_pending_bookings()
RETURNS TABLE(
    cancelled_count INTEGER,
    booking_ids UUID[]
) AS $$
DECLARE
    v_cancelled_count INTEGER;
    v_booking_ids UUID[];
BEGIN
    -- Get IDs of bookings to cancel
    SELECT ARRAY_AGG(id) INTO v_booking_ids
    FROM bookings
    WHERE status = 'pending'
      AND payment_status = 'pending'
      AND created_at < NOW() - INTERVAL '15 minutes';
    
    -- Update bookings to cancelled
    UPDATE bookings
    SET 
        status = 'cancelled',
        cancellation_reason = 'Payment timeout - no payment received within 15 minutes',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_booking_ids);
    
    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;
    
    -- Log cancellations to audit
    INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by_type, change_reason)
    SELECT 
        id, 
        'pending', 
        'cancelled', 
        'system',
        'Payment timeout'
    FROM bookings
    WHERE id = ANY(v_booking_ids);
    
    RETURN QUERY SELECT v_cancelled_count, v_booking_ids;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_pending_bookings IS 'Cancels bookings pending payment for >15 minutes. Run via cron.';

-- ============================================================================
-- 7. FUNCTION TO CHECK CANCELLATION ELIGIBILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION check_cancellation_allowed(
    p_booking_id UUID,
    OUT allowed BOOLEAN,
    OUT refund_percentage NUMERIC,
    OUT reason TEXT
) AS $$
DECLARE
    v_booking RECORD;
    v_rules RECORD;
    v_hours_until_booking INTEGER;
BEGIN
    -- Get booking details
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        allowed := false;
        refund_percentage := 0;
        reason := 'Booking not found';
        RETURN;
    END IF;
    
    -- Check if already cancelled
    IF v_booking.status IN ('cancelled', 'completed', 'no_show') THEN
        allowed := false;
        refund_percentage := 0;
        reason := 'Booking already ' || v_booking.status;
        RETURN;
    END IF;
    
    -- Calculate hours until booking
    IF v_booking.booking_datetime IS NOT NULL THEN
        v_hours_until_booking := EXTRACT(EPOCH FROM (v_booking.booking_datetime - NOW())) / 3600;
    ELSE
        -- Fallback to date + time
        v_hours_until_booking := EXTRACT(EPOCH FROM (
            (v_booking.booking_date::TEXT || ' ' || v_booking.booking_time::TEXT)::TIMESTAMP - NOW()
        )) / 3600;
    END IF;
    
    -- Get cancellation rules
    SELECT * INTO v_rules
    FROM booking_cancellation_rules
    WHERE (vendor_id = v_booking.vendor_id OR vendor_id IS NULL)
      AND (service_id = v_booking.service_id OR service_id IS NULL)
    ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
    LIMIT 1;
    
    -- Apply default rules if none found
    IF NOT FOUND THEN
        v_rules.cancellation_cutoff_hours := 24;
        v_rules.full_refund_before_hours := 48;
        v_rules.partial_refund_before_hours := 24;
        v_rules.partial_refund_percentage := 50.00;
    END IF;
    
    -- Check if within cancellation window
    IF v_hours_until_booking < 0 THEN
        allowed := false;
        refund_percentage := 0;
        reason := 'Cannot cancel past bookings';
    ELSIF v_hours_until_booking >= v_rules.full_refund_before_hours THEN
        allowed := true;
        refund_percentage := 100.00;
        reason := 'Full refund';
    ELSIF v_hours_until_booking >= v_rules.partial_refund_before_hours THEN
        allowed := true;
        refund_percentage := v_rules.partial_refund_percentage;
        reason := 'Partial refund (' || v_rules.partial_refund_percentage || '%)';
    ELSIF v_hours_until_booking >= v_rules.cancellation_cutoff_hours THEN
        allowed := true;
        refund_percentage := 0;
        reason := 'No refund (within ' || v_rules.cancellation_cutoff_hours || ' hours)';
    ELSE
        allowed := false;
        refund_percentage := 0;
        reason := 'Too close to appointment time';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_cancellation_allowed IS 'Checks if booking can be cancelled and calculates refund';

-- ============================================================================
-- 8. TRIGGER TO UPDATE booking_datetime
-- ============================================================================

CREATE OR REPLACE FUNCTION update_booking_datetime()
RETURNS TRIGGER AS $$
BEGIN
    -- If booking_date or booking_time changed, update booking_datetime
    IF NEW.booking_date IS NOT NULL AND NEW.booking_time IS NOT NULL THEN
        -- Get vendor timezone
        IF NEW.vendor_timezone IS NULL THEN
            SELECT timezone INTO NEW.vendor_timezone
            FROM vendors
            WHERE id = NEW.vendor_id
            LIMIT 1;
            
            IF NEW.vendor_timezone IS NULL THEN
                NEW.vendor_timezone := 'Asia/Kolkata';
            END IF;
        END IF;
        
        -- Combine date + time and set timezone
        NEW.booking_datetime := (NEW.booking_date::TEXT || ' ' || NEW.booking_time::TEXT)::TIMESTAMP AT TIME ZONE NEW.vendor_timezone;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_booking_datetime ON bookings;
CREATE TRIGGER trigger_update_booking_datetime
    BEFORE INSERT OR UPDATE OF booking_date, booking_time, vendor_timezone
    ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_datetime();

COMMENT ON TRIGGER trigger_update_booking_datetime ON bookings IS 'Automatically updates booking_datetime from date+time+timezone';

-- ============================================================================
-- 9. INDIA TIMEZONE UTILITIES
-- ============================================================================

-- Function to convert any timestamp to IST
CREATE OR REPLACE FUNCTION to_ist(ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN ts AT TIME ZONE 'Asia/Kolkata';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION to_ist IS 'Converts any timestamp to Indian Standard Time';

-- Function to get current IST time
CREATE OR REPLACE FUNCTION now_ist()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Kolkata';
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION now_ist IS 'Returns current time in IST';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


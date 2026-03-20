-- ============================================================================
-- MIGRATION 046: STATE MACHINE GUARDS & VALIDATION
-- ============================================================================
-- Date: 2026-01-03
-- Purpose: Implement state transition guards to prevent illegal state changes
--
-- Features:
-- 1. Booking state machine with allowed transitions
-- 2. Payment state machine with guards
-- 3. Refund state machine
-- 4. Settlement state machine
-- 5. Validation functions to enforce rules
-- ============================================================================

-- ============================================================================
-- 1. BOOKING STATE TRANSITION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    requires_payment BOOLEAN DEFAULT false,
    requires_vendor_approval BOOLEAN DEFAULT false,
    requires_customer_confirmation BOOLEAN DEFAULT false,
    min_hours_before_booking INTEGER,  -- NULL means no time restriction
    description TEXT,
    is_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(from_status, to_status)
);

-- Insert allowed transitions
INSERT INTO booking_state_transitions (from_status, to_status, requires_payment, description) VALUES
    -- Initial state
    ('pending', 'confirmed', true, 'Payment received, booking confirmed'),
    ('pending', 'cancelled', false, 'Customer cancels before payment'),
    
    -- Confirmed state
    ('confirmed', 'in_progress', false, 'Service started'),
    ('confirmed', 'cancelled', false, 'Cancellation with refund'),
    ('confirmed', 'rescheduled', false, 'Booking rescheduled'),
    
    -- In progress state
    ('in_progress', 'completed', false, 'Service completed successfully'),
    ('in_progress', 'cancelled', false, 'Service interrupted'),
    
    -- Terminal states (no transitions out)
    -- completed, cancelled, no_show are final
    
    -- No-show handling
    ('confirmed', 'no_show', false, 'Customer did not show up')
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE booking_state_transitions IS 'Defines allowed state transitions for bookings';

-- ============================================================================
-- 2. PAYMENT STATE TRANSITION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    requires_webhook BOOLEAN DEFAULT false,
    requires_admin_approval BOOLEAN DEFAULT false,
    max_amount_without_approval NUMERIC(10, 2),
    description TEXT,
    is_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(from_status, to_status)
);

INSERT INTO payment_state_transitions (from_status, to_status, requires_webhook, description) VALUES
    ('pending', 'processing', false, 'Payment initiated'),
    ('pending', 'failed', false, 'Payment failed'),
    ('pending', 'cancelled', false, 'Payment cancelled by user'),
    
    ('processing', 'completed', true, 'Payment captured (webhook)'),
    ('processing', 'failed', true, 'Payment failed (webhook)'),
    
    ('completed', 'refunded', false, 'Full refund processed'),
    ('completed', 'partially_refunded', false, 'Partial refund processed'),
    
    ('partially_refunded', 'refunded', false, 'Remaining amount refunded')
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE payment_state_transitions IS 'Defines allowed state transitions for payments';

-- ============================================================================
-- 3. REFUND STATE MACHINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS refund_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    requires_admin_approval BOOLEAN DEFAULT false,
    max_auto_refund_amount NUMERIC(10, 2) DEFAULT 5000.00,
    description TEXT,
    is_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(from_status, to_status)
);

INSERT INTO refund_state_transitions (from_status, to_status, requires_admin_approval, description) VALUES
    ('pending', 'approved', true, 'Admin approves refund'),
    ('pending', 'rejected', true, 'Admin rejects refund'),
    ('pending', 'auto_approved', false, 'Auto-approved (amount < threshold)'),
    
    ('approved', 'processing', false, 'Refund initiated with payment gateway'),
    ('auto_approved', 'processing', false, 'Auto-approved refund initiated'),
    
    ('processing', 'completed', false, 'Refund successful'),
    ('processing', 'failed', false, 'Refund failed at gateway'),
    
    ('failed', 'processing', true, 'Retry refund (admin)')
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE refund_state_transitions IS 'Defines allowed state transitions for refunds';

-- ============================================================================
-- 4. BOOKING STATE TRANSITION VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_booking_state_transition(
    p_booking_id UUID,
    p_new_status TEXT,
    OUT allowed BOOLEAN,
    OUT reason TEXT
) AS $$
DECLARE
    v_booking RECORD;
    v_transition RECORD;
    v_hours_until_booking NUMERIC;
BEGIN
    -- Get booking details
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        allowed := false;
        reason := 'Booking not found';
        RETURN;
    END IF;
    
    -- Check if already in target state
    IF v_booking.status = p_new_status THEN
        allowed := true;
        reason := 'Already in target state';
        RETURN;
    END IF;
    
    -- Check if transition is allowed
    SELECT * INTO v_transition
    FROM booking_state_transitions
    WHERE from_status = v_booking.status
      AND to_status = p_new_status
      AND is_allowed = true;
    
    IF NOT FOUND THEN
        allowed := false;
        reason := 'Transition from ' || v_booking.status || ' to ' || p_new_status || ' is not allowed';
        RETURN;
    END IF;
    
    -- Check payment requirement
    IF v_transition.requires_payment AND v_booking.payment_status != 'paid' THEN
        allowed := false;
        reason := 'Payment required for this transition';
        RETURN;
    END IF;
    
    -- Check time-based restrictions
    IF v_transition.min_hours_before_booking IS NOT NULL THEN
        IF v_booking.booking_datetime IS NOT NULL THEN
            v_hours_until_booking := EXTRACT(EPOCH FROM (v_booking.booking_datetime - NOW())) / 3600;
        ELSE
            v_hours_until_booking := EXTRACT(EPOCH FROM (
                (v_booking.booking_date::TEXT || ' ' || v_booking.booking_time::TEXT)::TIMESTAMP - NOW()
            )) / 3600;
        END IF;
        
        IF v_hours_until_booking < v_transition.min_hours_before_booking THEN
            allowed := false;
            reason := 'Transition requires at least ' || v_transition.min_hours_before_booking || ' hours before booking';
            RETURN;
        END IF;
    END IF;
    
    -- All checks passed
    allowed := true;
    reason := 'Transition allowed';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_booking_state_transition IS 'Validates if a booking state transition is allowed';

-- ============================================================================
-- 5. PAYMENT STATE TRANSITION VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_payment_state_transition(
    p_payment_id UUID,
    p_new_status TEXT,
    p_is_webhook BOOLEAN DEFAULT false,
    OUT allowed BOOLEAN,
    OUT reason TEXT
) AS $$
DECLARE
    v_payment RECORD;
    v_transition RECORD;
BEGIN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        allowed := false;
        reason := 'Payment not found';
        RETURN;
    END IF;
    
    IF v_payment.payment_status = p_new_status THEN
        allowed := true;
        reason := 'Already in target state';
        RETURN;
    END IF;
    
    SELECT * INTO v_transition
    FROM payment_state_transitions
    WHERE from_status = v_payment.payment_status
      AND to_status = p_new_status
      AND is_allowed = true;
    
    IF NOT FOUND THEN
        allowed := false;
        reason := 'Transition not allowed: ' || v_payment.payment_status || ' -> ' || p_new_status;
        RETURN;
    END IF;
    
    -- Check webhook requirement
    IF v_transition.requires_webhook AND NOT p_is_webhook THEN
        allowed := false;
        reason := 'This transition requires webhook authentication';
        RETURN;
    END IF;
    
    allowed := true;
    reason := 'Transition allowed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGER TO ENFORCE BOOKING STATE TRANSITIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_booking_state_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_validation RECORD;
BEGIN
    -- Only check if status is changing
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT * INTO v_validation
        FROM validate_booking_state_transition(NEW.id, NEW.status);
        
        IF NOT v_validation.allowed THEN
            RAISE EXCEPTION 'Invalid booking state transition: %', v_validation.reason;
        END IF;
        
        -- Log the transition
        INSERT INTO booking_status_history (
            booking_id, old_status, new_status, changed_by_type, metadata
        ) VALUES (
            NEW.id, OLD.status, NEW.status, 'system',
            jsonb_build_object('validation', v_validation.reason)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_enforce_booking_state ON bookings;
CREATE TRIGGER trigger_enforce_booking_state
    BEFORE UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION enforce_booking_state_transition();

COMMENT ON TRIGGER trigger_enforce_booking_state ON bookings IS 'Enforces valid state transitions for bookings';

-- ============================================================================
-- 7. PACKAGE EXPIRY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ NOT NULL,
    total_sessions INTEGER NOT NULL,
    used_sessions INTEGER DEFAULT 0,
    remaining_sessions INTEGER GENERATED ALWAYS AS (total_sessions - used_sessions) STORED,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'exhausted', 'cancelled')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (used_sessions <= total_sessions)
);

CREATE INDEX idx_package_usage_customer ON package_usage_tracking(customer_id);
CREATE INDEX idx_package_usage_status ON package_usage_tracking(status);
CREATE INDEX idx_package_usage_expiry ON package_usage_tracking(expiry_date) WHERE status = 'active';

COMMENT ON TABLE package_usage_tracking IS 'Tracks package purchases and usage with expiry enforcement';

-- ============================================================================
-- 8. PACKAGE EXPIRY ENFORCEMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_package_validity(
    p_customer_id UUID,
    p_package_id UUID,
    OUT is_valid BOOLEAN,
    OUT remaining_sessions INTEGER,
    OUT expiry_date TIMESTAMPTZ,
    OUT reason TEXT
) AS $$
DECLARE
    v_package RECORD;
BEGIN
    SELECT * INTO v_package
    FROM package_usage_tracking
    WHERE customer_id = p_customer_id
      AND package_id = p_package_id
      AND status = 'active'
    ORDER BY expiry_date DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        is_valid := false;
        remaining_sessions := 0;
        reason := 'No active package found';
        RETURN;
    END IF;
    
    -- Check expiry
    IF v_package.expiry_date < NOW() THEN
        -- Auto-expire the package
        UPDATE package_usage_tracking
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_package.id;
        
        is_valid := false;
        remaining_sessions := 0;
        expiry_date := v_package.expiry_date;
        reason := 'Package expired on ' || v_package.expiry_date::DATE;
        RETURN;
    END IF;
    
    -- Check remaining sessions
    IF v_package.remaining_sessions <= 0 THEN
        -- Auto-mark as exhausted
        UPDATE package_usage_tracking
        SET status = 'exhausted', updated_at = NOW()
        WHERE id = v_package.id;
        
        is_valid := false;
        remaining_sessions := 0;
        expiry_date := v_package.expiry_date;
        reason := 'All sessions used';
        RETURN;
    END IF;
    
    -- Package is valid
    is_valid := true;
    remaining_sessions := v_package.remaining_sessions;
    expiry_date := v_package.expiry_date;
    reason := 'Package valid';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. STAFF SHIFT OVERLAP PREVENTION
-- ============================================================================

-- Function to check for shift overlaps
CREATE OR REPLACE FUNCTION check_staff_shift_overlap(
    p_staff_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_shift_id UUID DEFAULT NULL,
    OUT has_overlap BOOLEAN,
    OUT conflicting_shifts UUID[]
) AS $$
BEGIN
    SELECT 
        COUNT(*) > 0,
        ARRAY_AGG(id)
    INTO has_overlap, conflicting_shifts
    FROM staff_availability
    WHERE staff_id = p_staff_id
      AND date = p_date
      AND (id != p_exclude_shift_id OR p_exclude_shift_id IS NULL)
      AND is_available = true
      AND (
          -- New shift starts during existing shift
          (p_start_time >= start_time AND p_start_time < end_time)
          OR
          -- New shift ends during existing shift
          (p_end_time > start_time AND p_end_time <= end_time)
          OR
          -- New shift completely contains existing shift
          (p_start_time <= start_time AND p_end_time >= end_time)
      );
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent shift overlaps
CREATE OR REPLACE FUNCTION prevent_staff_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_check RECORD;
BEGIN
    SELECT * INTO v_check
    FROM check_staff_shift_overlap(
        NEW.staff_id,
        NEW.date,
        NEW.start_time,
        NEW.end_time,
        NEW.id
    );
    
    IF v_check.has_overlap THEN
        RAISE EXCEPTION 'Staff shift overlaps with existing shift(s): %', v_check.conflicting_shifts;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_shift_overlap ON staff_availability;
CREATE TRIGGER trigger_prevent_shift_overlap
    BEFORE INSERT OR UPDATE ON staff_availability
    FOR EACH ROW
    EXECUTE FUNCTION prevent_staff_shift_overlap();

-- ============================================================================
-- 10. REFUND IDEMPOTENCY
-- ============================================================================

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_idempotency ON refunds(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add razorpay_refund_id unique constraint
ALTER TABLE refunds ADD CONSTRAINT IF NOT EXISTS unique_razorpay_refund_id 
    UNIQUE(razorpay_refund_id);

COMMENT ON COLUMN refunds.idempotency_key IS 'Prevents duplicate refund requests';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


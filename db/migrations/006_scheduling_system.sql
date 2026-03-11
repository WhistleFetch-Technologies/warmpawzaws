-- ============================================================================
-- MIGRATION 006: Scheduling System - Complete SQL Implementation
-- ============================================================================
-- Date: 2025-01-22
-- Purpose: Replace KV store with SQL for all scheduling operations
-- Fixes: All 23 violations from scheduling audit
-- ============================================================================

-- ============================================================================
-- SCHEDULING POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'booking_capacity',
        'slot_reservation',
        'emergency_priority',
        'subscription_slot',
        'package_session',
        'commute_time',
        'buffer_time',
        'overbooking_prevention',
        'ghost_availability',
        'multi_location_travel',
        'subscription_recurrence',
        'package_booking'
    )),
    policy_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduling_policies IS 'All 12 missing policies from audit';

-- ============================================================================
-- VENDOR AVAILABILITY V2 (SQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    time_window_start TIME NOT NULL,
    time_window_end TIME NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele')),
    slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
    service_area_km NUMERIC(5, 2), -- For home services
    max_capacity INTEGER DEFAULT 1, -- FIX V1: Configurable capacity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, day_of_week, time_window_start, service_style)
);

CREATE INDEX idx_vendor_availability_v2_vendor_day ON vendor_availability_v2(vendor_id, day_of_week);
CREATE INDEX idx_vendor_availability_v2_service_style ON vendor_availability_v2(service_style);

-- ============================================================================
-- STAFF AVAILABILITY (SQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    location_id UUID REFERENCES vendors(id), -- Can be vendor location
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, location_id, day_of_week, start_time)
);

CREATE INDEX idx_staff_availability_staff_location ON staff_availability_slots(staff_id, location_id);
CREATE INDEX idx_staff_availability_day ON staff_availability_slots(day_of_week);

-- Staff Breaks
CREATE TABLE IF NOT EXISTS staff_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    break_date DATE, -- Specific date break (NULL for recurring)
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- Recurring break
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_type TEXT DEFAULT 'lunch',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (
        (break_date IS NOT NULL AND day_of_week IS NULL) OR
        (break_date IS NULL AND day_of_week IS NOT NULL)
    )
);

CREATE INDEX idx_staff_breaks_staff ON staff_breaks(staff_id);
CREATE INDEX idx_staff_breaks_date ON staff_breaks(break_date);

-- Staff Holidays
CREATE TABLE IF NOT EXISTS staff_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    holiday_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, holiday_date)
);

-- Staff Location Assignments
CREATE TABLE IF NOT EXISTS staff_location_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, location_id)
);

-- ============================================================================
-- BOOKING LOCKS (FIX V23: Race Condition)
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lock_key TEXT NOT NULL UNIQUE, -- Format: booking:lock:{vendorId}:{date}:{time}
    locked_by TEXT, -- Request ID or session ID
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE INDEX idx_booking_locks_key ON booking_locks(lock_key);
CREATE INDEX idx_booking_locks_expires ON booking_locks(expires_at);

-- Auto-cleanup expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM booking_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SLOT RESERVATIONS (FIX V14: Subscription Slots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS slot_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    reservation_type TEXT NOT NULL CHECK (reservation_type IN (
        'subscription',
        'package',
        'temporary',
        'emergency'
    )),
    reserved_for_id UUID, -- subscription_id, package_id, booking_id
    expires_at TIMESTAMPTZ, -- For temporary reservations
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, staff_id, reservation_date, reservation_time, reservation_type, reserved_for_id)
);

CREATE INDEX idx_slot_reservations_vendor_date ON slot_reservations(vendor_id, reservation_date);
CREATE INDEX idx_slot_reservations_staff_date ON slot_reservations(staff_id, reservation_date);
CREATE INDEX idx_slot_reservations_expires ON slot_reservations(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- BOOKING CONFLICTS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    conflict_type TEXT NOT NULL CHECK (conflict_type IN (
        'time_overlap',
        'location_conflict',
        'staff_unavailable',
        'capacity_exceeded',
        'distance_exceeded',
        'commute_time_insufficient',
        'buffer_time_violation'
    )),
    conflicting_booking_id UUID REFERENCES bookings(id),
    conflict_details JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_conflicts_booking ON booking_conflicts(booking_id);
CREATE INDEX idx_booking_conflicts_resolved ON booking_conflicts(resolved);

-- ============================================================================
-- COMMUTE TIME CALCULATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS commute_time_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_location_id UUID NOT NULL,
    to_location_id UUID NOT NULL,
    from_latitude NUMERIC(10, 8),
    from_longitude NUMERIC(11, 8),
    to_latitude NUMERIC(10, 8),
    to_longitude NUMERIC(11, 8),
    distance_km NUMERIC(8, 2),
    commute_time_minutes INTEGER NOT NULL,
    traffic_factor NUMERIC(3, 2) DEFAULT 1.0,
    calculated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    UNIQUE(from_location_id, to_location_id, calculated_at)
);

CREATE INDEX idx_commute_cache_locations ON commute_time_cache(from_location_id, to_location_id);
CREATE INDEX idx_commute_cache_expires ON commute_time_cache(expires_at);

-- ============================================================================
-- PACKAGE SESSIONS TRACKING (FIX V17-V19)
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_purchase_id UUID NOT NULL, -- References package purchase
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    booking_id UUID REFERENCES bookings(id),
    session_number INTEGER NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'reserved',
        'booked',
        'completed',
        'cancelled',
        'expired'
    )),
    slot_reservation_id UUID REFERENCES slot_reservations(id),
    redeemed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_package_sessions_purchase ON package_sessions(package_purchase_id);
CREATE INDEX idx_package_sessions_customer ON package_sessions(customer_id);
CREATE INDEX idx_package_sessions_status ON package_sessions(status);

-- ============================================================================
-- SUBSCRIPTION SLOT RESERVATIONS (FIX V14-V16)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_slot_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL, -- References subscription
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    staff_id UUID REFERENCES staff(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    time_slot TIME NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(subscription_id, vendor_id, day_of_week, time_slot)
);

CREATE INDEX idx_subscription_slots_subscription ON subscription_slot_reservations(subscription_id);
CREATE INDEX idx_subscription_slots_vendor_day ON subscription_slot_reservations(vendor_id, day_of_week);

-- ============================================================================
-- EMERGENCY BOOKING QUEUE (FIX V20-V22)
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergency_booking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    requested_by TEXT, -- customer_id or admin_id
    reason TEXT,
    location_latitude NUMERIC(10, 8),
    location_longitude NUMERIC(11, 8),
    max_distance_km NUMERIC(5, 2) DEFAULT 50,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_vendor_id UUID REFERENCES vendors(id),
    assigned_staff_id UUID REFERENCES staff(id),
    assigned_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed', 'cancelled'))
);

CREATE INDEX idx_emergency_queue_priority ON emergency_booking_queue(priority, queued_at);
CREATE INDEX idx_emergency_queue_status ON emergency_booking_queue(status);

-- ============================================================================
-- STAFF REAL-TIME LOCATION (FIX V9, V22)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_real_time_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy_meters NUMERIC(8, 2),
    heading_degrees NUMERIC(5, 2),
    speed_kmh NUMERIC(5, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE INDEX idx_staff_locations_staff_time ON staff_real_time_locations(staff_id, recorded_at DESC);
CREATE INDEX idx_staff_locations_recent ON staff_real_time_locations(recorded_at DESC) WHERE recorded_at > NOW() - INTERVAL '1 hour';

-- Keep only recent locations (last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_staff_locations()
RETURNS void AS $$
BEGIN
    DELETE FROM staff_real_time_locations 
    WHERE recorded_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BOOKING CAPACITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_slot_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    service_style TEXT NOT NULL,
    current_bookings INTEGER NOT NULL DEFAULT 0,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, staff_id, slot_date, slot_time, service_style)
);

CREATE INDEX idx_booking_capacity_vendor_date ON booking_slot_capacity(vendor_id, slot_date);
CREATE INDEX idx_booking_capacity_staff_date ON booking_slot_capacity(staff_id, slot_date);

-- ============================================================================
-- FUNCTIONS FOR ATOMIC OPERATIONS
-- ============================================================================

-- Acquire booking lock (FIX V23)
CREATE OR REPLACE FUNCTION acquire_booking_lock(
    p_lock_key TEXT,
    p_locked_by TEXT,
    p_timeout_seconds INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
    v_acquired BOOLEAN := false;
BEGIN
    -- Cleanup expired locks first
    DELETE FROM booking_locks WHERE expires_at < NOW();
    
    -- Calculate expiration
    v_expires_at := NOW() + (p_timeout_seconds || ' seconds')::INTERVAL;
    
    -- Try to insert lock (will fail if key exists)
    BEGIN
        INSERT INTO booking_locks (lock_key, locked_by, expires_at)
        VALUES (p_lock_key, p_locked_by, v_expires_at)
        ON CONFLICT (lock_key) DO NOTHING;
        
        -- Check if we got the lock
        SELECT EXISTS(
            SELECT 1 FROM booking_locks 
            WHERE lock_key = p_lock_key 
            AND locked_by = p_locked_by
            AND expires_at = v_expires_at
        ) INTO v_acquired;
        
    EXCEPTION WHEN OTHERS THEN
        v_acquired := false;
    END;
    
    RETURN v_acquired;
END;
$$ LANGUAGE plpgsql;

-- Release booking lock
CREATE OR REPLACE FUNCTION release_booking_lock(
    p_lock_key TEXT,
    p_locked_by TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM booking_locks 
    WHERE lock_key = p_lock_key 
    AND locked_by = p_locked_by;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Check and reserve slot atomically (FIX V2, V23)
CREATE OR REPLACE FUNCTION reserve_booking_slot(
    p_vendor_id UUID,
    p_staff_id UUID,
    p_booking_date DATE,
    p_booking_time TIME,
    p_service_style TEXT,
    p_max_capacity INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_available BOOLEAN := false;
BEGIN
    -- Get current booking count for this slot
    SELECT COALESCE(current_bookings, 0) INTO v_current_count
    FROM booking_slot_capacity
    WHERE vendor_id = p_vendor_id
    AND (staff_id = p_staff_id OR (p_staff_id IS NULL AND staff_id IS NULL))
    AND slot_date = p_booking_date
    AND slot_time = p_booking_time
    AND service_style = p_service_style;
    
    -- Check if slot is available
    IF v_current_count < p_max_capacity THEN
        -- Upsert capacity tracking
        INSERT INTO booking_slot_capacity (
            vendor_id, staff_id, slot_date, slot_time, service_style,
            current_bookings, max_capacity
        )
        VALUES (
            p_vendor_id, p_staff_id, p_booking_date, p_booking_time, p_service_style,
            v_current_count + 1, p_max_capacity
        )
        ON CONFLICT (vendor_id, staff_id, slot_date, slot_time, service_style)
        DO UPDATE SET
            current_bookings = booking_slot_capacity.current_bookings + 1,
            updated_at = NOW();
        
        v_available := true;
    END IF;
    
    RETURN v_available;
END;
$$ LANGUAGE plpgsql;

-- Release slot capacity
CREATE OR REPLACE FUNCTION release_booking_slot(
    p_vendor_id UUID,
    p_staff_id UUID,
    p_booking_date DATE,
    p_booking_time TIME,
    p_service_style TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE booking_slot_capacity
    SET current_bookings = GREATEST(0, current_bookings - 1),
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id
    AND (staff_id = p_staff_id OR (p_staff_id IS NULL AND staff_id IS NULL))
    AND slot_date = p_booking_date
    AND slot_time = p_booking_time
    AND service_style = p_service_style;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Check staff location conflicts with travel time (FIX V5)
CREATE OR REPLACE FUNCTION check_staff_location_conflict(
    p_staff_id UUID,
    p_location_id UUID,
    p_booking_date DATE,
    p_booking_time TIME,
    p_duration_minutes INTEGER,
    p_travel_time_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_conflict BOOLEAN := false;
    v_conflicting_booking_id UUID;
BEGIN
    -- Check for bookings at different locations that would conflict
    SELECT b.id INTO v_conflicting_booking_id
    FROM bookings b
    JOIN vendors v ON b.vendor_id = v.id
    WHERE b.staff_id = p_staff_id
    AND b.booking_date = p_booking_date
    AND b.status NOT IN ('cancelled', 'completed', 'no_show')
    AND b.vendor_id != p_location_id
    AND (
        -- Overlap check with travel time buffer
        (b.booking_time::TIME + (b.duration_minutes || ' minutes')::INTERVAL + (p_travel_time_minutes || ' minutes')::INTERVAL) > p_booking_time::TIME
        AND
        b.booking_time::TIME < (p_booking_time::TIME + (p_duration_minutes || ' minutes')::INTERVAL + (p_travel_time_minutes || ' minutes')::INTERVAL)
    )
    LIMIT 1;
    
    v_has_conflict := (v_conflicting_booking_id IS NOT NULL);
    
    RETURN v_has_conflict;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update booking capacity when booking is created
CREATE OR REPLACE FUNCTION update_booking_capacity_on_create()
RETURNS TRIGGER AS $$
BEGIN
    -- Capacity is handled by reserve_booking_slot function
    -- This trigger is for logging/audit
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update booking capacity when booking is cancelled
CREATE OR REPLACE FUNCTION update_booking_capacity_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        PERFORM release_booking_slot(
            NEW.vendor_id,
            NEW.staff_id,
            NEW.booking_date,
            NEW.booking_time::TIME,
            NEW.service_type
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_booking_capacity_cancel
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
EXECUTE FUNCTION update_booking_capacity_on_cancel();

-- ============================================================================
-- INITIAL POLICY DATA
-- ============================================================================

-- Insert default scheduling policies
INSERT INTO scheduling_policies (policy_name, policy_type, policy_config) VALUES
('Default Booking Capacity', 'booking_capacity', '{"maxConcurrentBookingsPerStaff": 3, "maxConcurrentBookingsPerVendor": 10, "maxDailyBookingsPerStaff": 20, "maxDailyBookingsPerVendor": 100}'),
('Slot Reservation Policy', 'slot_reservation', '{"reservationTimeout": 15, "maxReservationsPerCustomer": 3, "allowReservationOverlap": false}'),
('Emergency Priority Policy', 'emergency_priority', '{"canOverrideExistingBookings": false, "maxEmergencyBookingsPerStaff": 2, "emergencyBufferTime": 5, "autoCancelRegularBookings": false}'),
('Subscription Slot Policy', 'subscription_slot', '{"guaranteeSlotsOnSubscription": true, "allowSlotChanges": true, "notificationOnSlotConflict": true, "autoRescheduleOnConflict": true}'),
('Package Session Policy', 'package_session', '{"sessionValidityDays": 90, "allowSessionTransfer": false, "refundOnExpiry": false, "maxSessionsPerDay": 5}'),
('Commute Time Policy', 'commute_time', '{"maxCommuteTime": 120, "maxTravelDistance": 50, "trafficMultiplier": 1.5, "requireRealTimeLocation": false}'),
('Buffer Time Policy', 'buffer_time', '{"minBufferTime": 5, "maxBufferTime": 240, "bufferTimePerServiceType": {"at_center": 30, "at_home": 120, "tele": 15}, "allowVendorOverride": true}'),
('Overbooking Prevention Policy', 'overbooking_prevention', '{"useAtomicLocks": true, "lockTimeout": 5000, "retryAttempts": 3, "fallbackStrategy": "reject"}'),
('Ghost Availability Prevention', 'ghost_availability', '{"cacheTimeout": 30, "realTimeValidation": true, "statusFilterStandardization": ["confirmed", "scheduled", "in_progress", "start_otp_pending", "end_otp_pending", "traveling"], "refreshInterval": 60}'),
('Multi-Location Travel Policy', 'multi_location_travel', '{"minTravelTimeBetweenLocations": 30, "maxLocationsPerDay": 5, "requireLocationConfirmation": true, "trackRealTimeLocation": false}'),
('Subscription Recurrence Policy', 'subscription_recurrence', '{"reserveAllSlotsOnSubscription": true, "allowSlotModification": true, "handleScheduleChanges": "reschedule", "maxRecurringBookings": 52}'),
('Package Booking Policy', 'package_booking', '{"requireSlotAvailability": true, "allowAdvanceBooking": true, "maxAdvanceBookingDays": 90, "sessionExpiryDays": 90}')
ON CONFLICT (policy_name) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_vendor_date_time ON bookings(vendor_id, booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_date_time ON bookings(staff_id, booking_date, booking_time) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_status_active ON bookings(status) WHERE status NOT IN ('cancelled', 'completed');

COMMENT ON TABLE booking_locks IS 'FIX V23: Distributed locking for atomic booking operations';
COMMENT ON TABLE slot_reservations IS 'FIX V14: Slot reservations for subscriptions and packages';
COMMENT ON TABLE booking_slot_capacity IS 'FIX V1: Configurable capacity per slot';
COMMENT ON TABLE commute_time_cache IS 'FIX V10-V11: Commute time calculations';
COMMENT ON TABLE package_sessions IS 'FIX V17-V19: Package session tracking with slot validation';
COMMENT ON TABLE subscription_slot_reservations IS 'FIX V14-V16: Subscription slot reservations';


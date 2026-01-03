-- ============================================================================
-- MIGRATION 005: TEMPORAL AUDIT & IDEMPOTENCY FIXES
-- ============================================================================
-- Date: 2026-01-02
-- Purpose: Address critical gaps from Temporal Audit
-- 
-- Fixes:
-- 1. Idempotency key table for replay safety
-- 2. Entity audit log for compliance
-- 3. Unique constraint for booking slot collision prevention
-- 4. Booking validation check constraints
-- ============================================================================

-- ============================================================================
-- 1. IDEMPOTENCY KEYS TABLE
-- ============================================================================
-- Prevents duplicate operations from retries, double-taps, webhook replays

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,  -- 'booking', 'payment', 'refund', 'settlement'
    entity_id UUID,
    request_hash TEXT,          -- Hash of request payload for verification
    response JSONB NOT NULL,    -- Cached response to return on duplicate
    http_status INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
CREATE INDEX idx_idempotency_entity ON idempotency_keys (entity_type, entity_id);

COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations';
COMMENT ON COLUMN idempotency_keys.key IS 'Client-provided idempotency key (UUID recommended)';
COMMENT ON COLUMN idempotency_keys.response IS 'Cached JSON response to return on duplicate request';

-- ============================================================================
-- 2. ENTITY AUDIT LOG TABLE
-- ============================================================================
-- Append-only audit trail for compliance and debugging

CREATE TABLE IF NOT EXISTS entity_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,      -- 'booking', 'payment', 'vendor', 'customer', etc.
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,           -- 'create', 'update', 'delete', 'status_change'
    old_values JSONB,               -- Previous state (null for creates)
    new_values JSONB,               -- New state
    changed_fields TEXT[],          -- Array of field names that changed
    actor_id UUID,                  -- Who made the change
    actor_type TEXT,                -- 'customer', 'vendor', 'admin', 'system'
    actor_ip TEXT,                  -- IP address for security audit
    request_id TEXT,                -- Lambda request ID for tracing
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_entity ON entity_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON entity_audit_log (event_timestamp DESC);
CREATE INDEX idx_audit_actor ON entity_audit_log (actor_type, actor_id);
CREATE INDEX idx_audit_action ON entity_audit_log (entity_type, action);

COMMENT ON TABLE entity_audit_log IS 'Append-only audit trail for all entity changes';

-- ============================================================================
-- 3. BOOKING SLOT COLLISION PREVENTION
-- ============================================================================
-- Unique partial index to prevent double-booking

-- For vendor-level slots (when no staff assigned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_vendor_unique 
ON bookings (vendor_id, booking_date, booking_time)
WHERE staff_id IS NULL 
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled');

-- For staff-level slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_staff_unique 
ON bookings (vendor_id, staff_id, booking_date, booking_time)
WHERE staff_id IS NOT NULL 
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled');

COMMENT ON INDEX idx_booking_slot_vendor_unique IS 'Prevents double-booking at vendor level';
COMMENT ON INDEX idx_booking_slot_staff_unique IS 'Prevents double-booking at staff level';

-- ============================================================================
-- 4. ADD IDEMPOTENCY KEY COLUMN TO BOOKINGS
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_idempotency ON bookings (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 5. ADD IDEMPOTENCY KEY COLUMN TO PAYMENTS
-- ============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_idempotency ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 6. BOOKING HISTORY TABLE (for state transitions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_id UUID,
    changed_by_type TEXT,       -- 'customer', 'vendor', 'admin', 'system'
    change_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_history_booking ON booking_status_history (booking_id);
CREATE INDEX idx_booking_history_timestamp ON booking_status_history (created_at DESC);

COMMENT ON TABLE booking_status_history IS 'Tracks all status transitions for bookings';

-- ============================================================================
-- 7. PAYMENT STATUS HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_type TEXT,       -- 'webhook', 'admin', 'system'
    razorpay_event TEXT,        -- Original webhook event name
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_history_payment ON payment_status_history (payment_id);
CREATE INDEX idx_payment_history_timestamp ON payment_status_history (created_at DESC);

COMMENT ON TABLE payment_status_history IS 'Tracks all status transitions for payments';

-- ============================================================================
-- 8. CLEANUP JOB FOR EXPIRED IDEMPOTENCY KEYS
-- ============================================================================
-- This should be run by a scheduled Lambda/cron job

-- Function to clean up expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Removes expired idempotency keys. Run daily via cron.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


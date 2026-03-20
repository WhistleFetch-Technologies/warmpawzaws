-- ============================================================================
-- MIGRATION 062: CREATE BOOKING STATUS HISTORY TABLE
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Create booking_status_history table for booking history endpoint
-- ============================================================================

-- Booking Status History Table
CREATE TABLE IF NOT EXISTS booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    changed_by_type TEXT DEFAULT 'system' CHECK (changed_by_type IN ('system', 'customer', 'vendor', 'admin', 'staff')),
    reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for booking_status_history
CREATE INDEX IF NOT EXISTS idx_booking_status_history_booking_id ON booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_status_history_created_at ON booking_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_status_history_status ON booking_status_history(new_status);

-- Comments
COMMENT ON TABLE booking_status_history IS 'Audit trail of booking status changes';
COMMENT ON COLUMN booking_status_history.old_status IS 'Previous booking status';
COMMENT ON COLUMN booking_status_history.new_status IS 'New booking status';
COMMENT ON COLUMN booking_status_history.changed_by IS 'ID of user/system that changed the status';
COMMENT ON COLUMN booking_status_history.changed_by_type IS 'Type of actor that changed the status';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

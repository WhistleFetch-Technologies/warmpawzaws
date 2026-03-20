-- ============================================================================
-- 511: Create scheduling_policies table only (for seed compatibility)
-- ============================================================================
-- Use when full 006 cannot be run due to schema drift.
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

CREATE INDEX IF NOT EXISTS idx_scheduling_policies_active ON scheduling_policies(is_active) WHERE is_active = true;
COMMENT ON TABLE scheduling_policies IS 'Scheduling policies (buffer, slot, etc.)';

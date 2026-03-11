-- ============================================================================
-- MIGRATION 540: CREATE BOOKING_POLICIES TABLE
-- ============================================================================
-- Date: 2026-02-21
-- Purpose: Create booking_policies table for cancellation and refund policies
--          per vendor and service type
-- ============================================================================

-- ============================================================================
-- BOOKING POLICIES TABLE
-- ============================================================================
-- Stores cancellation, refund, and other booking-related policies
-- Can be vendor-specific, service-type-specific, or general

CREATE TABLE IF NOT EXISTS booking_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_type TEXT, -- 'at_home', 'at_center', 'tele', 'at_vendor', etc.
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'cancellation',
        'refund',
        'rescheduling',
        'no_show',
        'payment',
        'general'
    )),
    policy_name TEXT NOT NULL,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb, -- Flexible JSON structure for policy rules
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher value = higher precedence when multiple policies match
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_booking_policies_vendor_service ON booking_policies(vendor_id, service_type) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_policies_service_type ON booking_policies(service_type) WHERE service_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_policies_policy_type ON booking_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_booking_policies_active ON booking_policies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_booking_policies_priority ON booking_policies(priority DESC);

-- Comments
COMMENT ON TABLE booking_policies IS 'Stores cancellation, refund, and other booking-related policies per vendor and service type';
COMMENT ON COLUMN booking_policies.vendor_id IS 'Vendor this policy applies to. NULL = applies to all vendors';
COMMENT ON COLUMN booking_policies.service_type IS 'Service type this policy applies to (at_home, at_center, tele, etc.). NULL = applies to all service types';
COMMENT ON COLUMN booking_policies.policy_type IS 'Type of policy: cancellation, refund, rescheduling, no_show, payment, general';
COMMENT ON COLUMN booking_policies.rules IS 'JSON structure containing policy rules. For cancellation: {timeBased: [{hoursBefore, refundPercentage, cancellationFee}], reasonBased: {...}}';
COMMENT ON COLUMN booking_policies.priority IS 'Higher value = higher precedence when multiple policies match. Used for vendor-specific overrides';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

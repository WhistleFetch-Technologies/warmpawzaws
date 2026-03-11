-- ============================================================================
-- MIGRATION 060: CREATE REFUND RULES TABLES
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Create refund rules and cancellation rules tables for refund policy engine
-- ============================================================================

-- Refund Rules Table (vendor-specific or platform-wide)
CREATE TABLE IF NOT EXISTS refund_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID,
    service_style TEXT, -- 'at_center', 'at_home', 'tele', etc.
    rule_type TEXT NOT NULL CHECK (rule_type IN ('time_based', 'amount_based', 'status_based', 'custom')),
    
    -- Time-based rules
    full_refund_before_hours INTEGER DEFAULT 48,
    partial_refund_before_hours INTEGER DEFAULT 24,
    partial_refund_percentage INTEGER DEFAULT 50,
    cancellation_cutoff_hours INTEGER DEFAULT 2,
    
    -- Amount-based rules
    min_refund_amount NUMERIC(10, 2),
    max_refund_amount NUMERIC(10, 2),
    
    -- Status-based rules
    no_show_refund_percentage INTEGER DEFAULT 0,
    completed_refund_percentage INTEGER DEFAULT 0,
    
    -- Custom rules (JSONB for flexibility)
    custom_rules JSONB,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    is_platform_default BOOLEAN DEFAULT false, -- Platform-wide default rules
    priority INTEGER DEFAULT 0, -- Higher priority rules override lower priority
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT refund_rules_vendor_or_platform CHECK (
        (vendor_id IS NOT NULL AND is_platform_default = false) OR
        (vendor_id IS NULL AND is_platform_default = true)
    )
);

-- Booking Cancellation Rules (matches migration 044 schema for compatibility)
CREATE TABLE IF NOT EXISTS booking_cancellation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID,
    
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

-- Indexes for refund_rules
CREATE INDEX IF NOT EXISTS idx_refund_rules_vendor_id ON refund_rules(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refund_rules_service_id ON refund_rules(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refund_rules_service_style ON refund_rules(service_style) WHERE service_style IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refund_rules_platform_default ON refund_rules(is_platform_default) WHERE is_platform_default = true;
CREATE INDEX IF NOT EXISTS idx_refund_rules_active ON refund_rules(is_active) WHERE is_active = true;

-- Indexes for booking_cancellation_rules (only for columns that exist)
CREATE INDEX IF NOT EXISTS idx_booking_cancellation_rules_vendor_id ON booking_cancellation_rules(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_cancellation_rules_service_id ON booking_cancellation_rules(service_id) WHERE service_id IS NOT NULL;

-- Insert default platform-wide refund rules
INSERT INTO refund_rules (
    rule_type,
    full_refund_before_hours,
    partial_refund_before_hours,
    partial_refund_percentage,
    cancellation_cutoff_hours,
    is_platform_default,
    is_active,
    priority
) VALUES (
    'time_based',
    48,  -- Full refund if cancelled 48+ hours before
    24,  -- Partial refund if cancelled 24-48 hours before
    50,  -- 50% refund
    2,   -- No refund if cancelled less than 2 hours before
    true,
    true,
    0
) ON CONFLICT DO NOTHING;

-- Insert default platform-wide cancellation rules (for backward compatibility)
-- Note: booking_cancellation_rules table schema from migration 044 doesn't have rule_type, is_platform_default, is_active, priority
-- So we insert only the columns that exist in the actual schema
INSERT INTO booking_cancellation_rules (
    vendor_id,
    service_id,
    cancellation_cutoff_hours,
    full_refund_before_hours,
    partial_refund_before_hours,
    partial_refund_percentage,
    no_refund_before_hours,
    reschedule_allowed,
    reschedule_cutoff_hours,
    max_reschedules
) VALUES (
    NULL,  -- Platform-wide default (no vendor_id)
    NULL,  -- Platform-wide default (no service_id)
    24,    -- Cancellation cutoff: 24 hours
    48,    -- Full refund before 48 hours
    24,    -- Partial refund before 24 hours
    50.00, -- 50% refund
    2,     -- No refund before 2 hours
    true,  -- Reschedule allowed
    12,    -- Reschedule cutoff: 12 hours
    2      -- Max reschedules: 2
) ON CONFLICT (vendor_id, service_id) DO NOTHING;

-- Comments
COMMENT ON TABLE refund_rules IS 'Refund policy rules for bookings - vendor-specific or platform-wide defaults';
COMMENT ON TABLE booking_cancellation_rules IS 'Booking cancellation rules (alias for refund_rules for backward compatibility)';
COMMENT ON COLUMN refund_rules.full_refund_before_hours IS 'Hours before booking for full refund eligibility';
COMMENT ON COLUMN refund_rules.partial_refund_before_hours IS 'Hours before booking for partial refund eligibility';
COMMENT ON COLUMN refund_rules.partial_refund_percentage IS 'Percentage of refund for partial refunds';
COMMENT ON COLUMN refund_rules.cancellation_cutoff_hours IS 'Hours before booking when cancellation is no longer allowed';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- ============================================================================
-- Migration 550: Create admin tables missing on Prod RDS (align with Dev)
-- ============================================================================
-- Run this on Prod after DB migration so admin config import and UI work.
-- All CREATE TABLE IF NOT EXISTS - safe to run multiple times.
-- ============================================================================

-- Settlement rules (used by Finance → Settlement Rules; backend expects this table)
CREATE TABLE IF NOT EXISTS settlement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL DEFAULT 'settlement',
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlement_rules_priority ON settlement_rules(priority);
CREATE INDEX IF NOT EXISTS idx_settlement_rules_active ON settlement_rules(is_active) WHERE is_active = true;

-- Report templates (054)
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('financial', 'operational', 'vendor', 'customer', 'custom')),
    parameters JSONB DEFAULT '[]'::jsonb,
    schedule JSONB,
    last_generated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);

-- Content pages (054)
CREATE TABLE IF NOT EXISTS content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT,
    category TEXT CHECK (category IN ('legal', 'help', 'marketing', 'other')),
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_pages_slug ON content_pages(slug);
CREATE INDEX IF NOT EXISTS idx_content_pages_category ON content_pages(category);
CREATE INDEX IF NOT EXISTS idx_content_pages_published ON content_pages(is_published) WHERE is_published = true;

-- Scheduling policies (511)
CREATE TABLE IF NOT EXISTS scheduling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'booking_capacity', 'slot_reservation', 'emergency_priority', 'subscription_slot',
        'package_session', 'commute_time', 'buffer_time', 'overbooking_prevention',
        'ghost_availability', 'multi_location_travel', 'subscription_recurrence', 'package_booking'
    )),
    policy_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduling_policies_active ON scheduling_policies(is_active) WHERE is_active = true;

-- Problem grid mappings (074b)
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id TEXT NOT NULL,
    problem_name TEXT NOT NULL,
    problem_display_name TEXT,
    role_id TEXT NOT NULL,
    sub_category_id TEXT NOT NULL,
    sub_category_name TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(problem_id, sub_category_id)
);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_problem_id ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_role_id ON problem_grid_mappings(role_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_sub_category ON problem_grid_mappings(sub_category_id);

-- Vendor payment rules (053)
CREATE TABLE IF NOT EXISTS vendor_payment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    vendor_types TEXT[],
    service_location TEXT NOT NULL DEFAULT 'both' CHECK (service_location IN ('home', 'clinic', 'both', 'tele', 'all')),
    reservation_type TEXT NOT NULL DEFAULT 'flat' CHECK (reservation_type IN ('flat', 'percentage')),
    reservation_percentage NUMERIC(5, 2) CHECK (reservation_percentage BETWEEN 0 AND 100),
    flat_amount NUMERIC(10, 2) CHECK (flat_amount >= 0),
    minimum_advance_payment NUMERIC(10, 2) DEFAULT 0,
    partial_payment_allowed BOOLEAN DEFAULT true,
    escrow_hold_period_hours INTEGER DEFAULT 24,
    cancellation_grace_period_hours INTEGER DEFAULT 2,
    auto_capture_payment BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_rules_active ON vendor_payment_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_rules_priority ON vendor_payment_rules(priority DESC);

-- Vendor refund tiers — align with Admin Finance cancellation/refund policy (see migrations 536–542, 553)
CREATE TABLE IF NOT EXISTS vendor_refund_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    vendor_types TEXT[],
    service_location TEXT NOT NULL DEFAULT 'both' CHECK (service_location IN ('home', 'clinic', 'both', 'tele', 'all')),
    hours_before_service INTEGER NOT NULL,
    refund_percentage NUMERIC(5, 2) NOT NULL CHECK (refund_percentage BETWEEN 0 AND 100),
    cancellation_fee NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    tier_level INTEGER DEFAULT 0,
    cancelled_by TEXT NOT NULL DEFAULT 'pet_parent',
    max_partial_refund_percentage NUMERIC(5, 2),
    service_category TEXT,
    service_format TEXT,
    cancellation_window TEXT,
    vendor_cancellation_reason TEXT,
    hours_operator TEXT,
    hours_threshold NUMERIC(10, 2),
    policy_extensions JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_vendor_refund_tiers_cancelled_by CHECK (cancelled_by IN ('pet_parent', 'provider'))
);
CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_active ON vendor_refund_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_level ON vendor_refund_tiers(tier_level ASC);

-- Booking cancellation rules (060)
CREATE TABLE IF NOT EXISTS booking_cancellation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID,
    cancellation_cutoff_hours INTEGER NOT NULL DEFAULT 24,
    full_refund_before_hours INTEGER DEFAULT 48,
    partial_refund_before_hours INTEGER DEFAULT 24,
    partial_refund_percentage NUMERIC(5, 2) DEFAULT 50.00,
    no_refund_before_hours INTEGER DEFAULT 0,
    reschedule_allowed BOOLEAN DEFAULT true,
    reschedule_cutoff_hours INTEGER DEFAULT 12,
    max_reschedules INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, service_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_cancellation_rules_vendor_id ON booking_cancellation_rules(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_cancellation_rules_service_id ON booking_cancellation_rules(service_id) WHERE service_id IS NOT NULL;

-- GST rules (512)
CREATE TABLE IF NOT EXISTS gst_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    role_id UUID,
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele', 'hybrid')),
    category TEXT,
    min_amount NUMERIC(10, 2),
    max_amount NUMERIC(10, 2),
    customer_state TEXT,
    vendor_state TEXT,
    gst_type TEXT NOT NULL CHECK (gst_type IN ('percentage', 'fixed')) DEFAULT 'percentage',
    gst_rate NUMERIC(5, 2) NOT NULL CHECK (gst_rate >= 0 AND gst_rate <= 100),
    cgst_percentage NUMERIC(5, 2),
    sgst_percentage NUMERIC(5, 2),
    igst_percentage NUMERIC(5, 2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gst_rules_priority ON gst_rules(priority) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_gst_rules_role_service ON gst_rules(role_id, service_style) WHERE enabled = true;

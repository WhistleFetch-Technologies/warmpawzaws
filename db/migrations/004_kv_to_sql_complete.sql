-- ============================================================================
-- MIGRATION 004: Complete KV to SQL Migration - Missing Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add all missing tables to replace KV store completely
-- ============================================================================

-- ============================================================================
-- PLATFORM SETTINGS (Replaces platform:settings:* KV keys)
-- ============================================================================

-- AWS Settings
CREATE TABLE IF NOT EXISTS aws_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE DEFAULT 'aws',
    credentials JSONB NOT NULL DEFAULT '{}',
    s3_config JSONB DEFAULT '{}',
    sns_config JSONB DEFAULT '{}',
    sqs_config JSONB DEFAULT '{}',
    chime_config JSONB DEFAULT '{}',
    bedrock_config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Google Maps Settings
CREATE TABLE IF NOT EXISTS google_maps_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE DEFAULT 'google_maps',
    api_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    region TEXT DEFAULT 'IN',
    language TEXT DEFAULT 'en',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Payment Gateway Settings (Replaces platform:settings:payment_gateway)
CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_name TEXT NOT NULL UNIQUE,
    gateway_type TEXT NOT NULL CHECK (gateway_type IN ('razorpay', 'stripe', 'paypal', 'paytm')),
    key_id TEXT,
    key_secret TEXT,
    webhook_secret TEXT,
    marketplace_mode BOOLEAN DEFAULT true,
    enabled BOOLEAN DEFAULT true,
    test_mode BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logistics Partners (Replaces admin:settings:logistics_partners)
CREATE TABLE IF NOT EXISTS logistics_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id TEXT NOT NULL UNIQUE,
    partner_name TEXT NOT NULL,
    partner_type TEXT NOT NULL CHECK (partner_type IN ('shiprocket', 'delhivery', 'dunzo', 'other')),
    email TEXT,
    password TEXT,
    api_key TEXT,
    api_secret TEXT,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logistics Rules
CREATE TABLE IF NOT EXISTS logistics_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL,
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SERVICE STYLE MAPPING (Standardization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_style_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_name TEXT NOT NULL UNIQUE,
    standard_name TEXT NOT NULL CHECK (standard_name IN ('at_center', 'at_home', 'tele')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert standard mappings
INSERT INTO service_style_mappings (legacy_name, standard_name, description) VALUES
    ('clinic', 'at_center', 'Legacy clinic mapping'),
    ('home', 'at_home', 'Legacy home mapping'),
    ('both', 'at_center', 'Legacy both mapping - defaults to at_center'),
    ('at_clinic', 'at_center', 'Legacy at_clinic mapping'),
    ('at_vendor', 'at_center', 'Legacy at_vendor mapping'),
    ('online', 'tele', 'Legacy online mapping'),
    ('tele-consultation', 'tele', 'Legacy tele-consultation mapping')
ON CONFLICT (legacy_name) DO NOTHING;

-- ============================================================================
-- BOOKING STATUS TRANSITIONS (Automatic State Machine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_status_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    transition_type TEXT NOT NULL CHECK (transition_type IN ('automatic', 'manual', 'scheduled')),
    scheduled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    executed_by UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BUSINESS RULES ENFORCEMENT
-- ============================================================================

-- Cancellation Policies (Enhanced)
CREATE TABLE IF NOT EXISTS cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    service_type TEXT,
    hours_before_booking INTEGER NOT NULL,
    cancellation_fee_percentage NUMERIC(5, 2) NOT NULL,
    refund_percentage NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rescheduling Policies
CREATE TABLE IF NOT EXISTS rescheduling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    service_type TEXT,
    hours_before_booking INTEGER NOT NULL,
    rescheduling_fee_percentage NUMERIC(5, 2) DEFAULT 0,
    max_reschedules INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No-Show Policies
CREATE TABLE IF NOT EXISTS no_show_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    service_type TEXT,
    penalty_percentage NUMERIC(5, 2) NOT NULL,
    blacklist_after_count INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Timeout Rules
CREATE TABLE IF NOT EXISTS payment_timeout_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    timeout_minutes INTEGER NOT NULL DEFAULT 15,
    auto_cancel_booking BOOLEAN DEFAULT true,
    retry_attempts INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Limits
CREATE TABLE IF NOT EXISTS booking_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_type TEXT NOT NULL CHECK (limit_type IN ('per_customer_per_day', 'per_vendor_per_slot', 'concurrent')),
    limit_value INTEGER NOT NULL,
    service_type TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUTOMATION JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('status_transition', 'payout_processing', 'shipment_creation', 'review_request', 'reminder')),
    job_status TEXT NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'processing', 'completed', 'failed')),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DELIVERY & SHIPMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    logistics_partner_id UUID,
    awb_code TEXT,
    courier_name TEXT,
    pickup_pincode TEXT NOT NULL,
    delivery_pincode TEXT NOT NULL,
    weight_kg NUMERIC(5, 2),
    shipment_status TEXT NOT NULL DEFAULT 'pending' CHECK (shipment_status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')),
    tracking_url TEXT,
    estimated_delivery_date DATE,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_description TEXT,
    location TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MULTI-STAFF ASSIGNMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_staff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    staff_id UUID NOT NULL,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'secondary', 'backup')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    UNIQUE(booking_id, staff_id)
);

-- ============================================================================
-- PAYMENT RETRY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_retry_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL,
    retry_attempt INTEGER NOT NULL,
    retry_status TEXT NOT NULL CHECK (retry_status IN ('pending', 'processing', 'success', 'failed')),
    error_message TEXT,
    retried_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_booking_status_transitions_booking_id ON booking_status_transitions(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_status_transitions_scheduled ON booking_status_transitions(scheduled_at) WHERE executed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_automation_jobs_scheduled ON automation_jobs(scheduled_at) WHERE job_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_automation_jobs_type ON automation_jobs(job_type, job_status);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(shipment_status);
CREATE INDEX IF NOT EXISTS idx_booking_staff_assignments_booking ON booking_staff_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_staff_assignments_staff ON booking_staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_payment_retry_log_payment ON payment_retry_log(payment_id);

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_status_transitions_booking_fkey') THEN
        ALTER TABLE booking_status_transitions ADD CONSTRAINT booking_status_transitions_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_jobs_entity_fkey') THEN
        -- Note: Entity type varies, so we can't add FK constraint
        -- We'll rely on application-level validation
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_order_fkey') THEN
        ALTER TABLE shipments ADD CONSTRAINT shipments_order_fkey
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_partner_fkey') THEN
        ALTER TABLE shipments ADD CONSTRAINT shipments_partner_fkey
            FOREIGN KEY (logistics_partner_id) REFERENCES logistics_partners(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipment_tracking_events_shipment_fkey') THEN
        ALTER TABLE shipment_tracking_events ADD CONSTRAINT shipment_tracking_events_shipment_fkey
            FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_staff_assignments_booking_fkey') THEN
        ALTER TABLE booking_staff_assignments ADD CONSTRAINT booking_staff_assignments_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_staff_assignments_staff_fkey') THEN
        ALTER TABLE booking_staff_assignments ADD CONSTRAINT booking_staff_assignments_staff_fkey
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_retry_log_payment_fkey') THEN
        ALTER TABLE payment_retry_log ADD CONSTRAINT payment_retry_log_payment_fkey
            FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Update bookings table to fix service_type constraint
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_service_type_check'
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_service_type_check;
    END IF;
    
    -- Add new constraint with standardized values
    ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check 
        CHECK (service_type IN ('at_center', 'at_home', 'tele', 'hybrid', 'product', 'online'));
END $$;

-- ============================================================================
-- END OF MIGRATION 004
-- ============================================================================


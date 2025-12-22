-- ============================================================================
-- MIGRATION 005: Lifecycle Completeness - Missing States & Handlers
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add missing lifecycle states and handlers for all services
-- ============================================================================

-- ============================================================================
-- UPDATE BOOKINGS TABLE - Add Missing States
-- ============================================================================

-- Update bookings status constraint to include all required states
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_status_check'
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
    END IF;
    
    -- Add comprehensive constraint with all lifecycle states
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
        CHECK (status IN (
            'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 
            'no_show', 'rescheduled',
            -- Package states
            'partially_completed',
            -- Subscription states
            'active', 'paused', 'renewal_pending', 'expired',
            -- Insurance states
            'claim_pending', 'claim_approved', 'claim_rejected',
            -- Adoption states
            'approved', 'rejected'
        ));
END $$;

-- ============================================================================
-- INSURANCE CLAIMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    policy_id UUID,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('medical', 'accident', 'illness', 'surgery', 'other')),
    claim_amount NUMERIC(10, 2) NOT NULL,
    claim_status TEXT NOT NULL DEFAULT 'claim_pending' CHECK (claim_status IN ('claim_pending', 'claim_approved', 'claim_rejected', 'claim_processed')),
    claim_description TEXT NOT NULL,
    supporting_documents JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    approved_amount NUMERIC(10, 2),
    rejection_reason TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_booking ON insurance_claims(booking_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_customer ON insurance_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(claim_status);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    vendor_id UUID,
    service_id UUID NOT NULL,
    subscription_type TEXT NOT NULL CHECK (subscription_type IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'renewal_pending')),
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE,
    billing_amount NUMERIC(10, 2) NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    payment_method TEXT,
    last_payment_id UUID,
    pause_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'shipped', 'delivered', 'failed')),
    shipment_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    billing_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_booking ON subscriptions(booking_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_subscription ON subscription_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);

-- ============================================================================
-- ADOPTION APPLICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS adoption_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    pet_id UUID NOT NULL,
    application_status TEXT NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'completed')),
    application_data JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    approval_reason TEXT,
    rejection_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_applications_booking ON adoption_applications(booking_id);
CREATE INDEX IF NOT EXISTS idx_adoption_applications_customer ON adoption_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_adoption_applications_status ON adoption_applications(application_status);

-- ============================================================================
-- PACKAGE MILESTONES
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    milestone_number INTEGER NOT NULL,
    milestone_type TEXT NOT NULL CHECK (milestone_type IN ('session', 'day', 'week', 'month')),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_package_milestones_booking ON package_milestones(booking_id);
CREATE INDEX IF NOT EXISTS idx_package_milestones_status ON package_milestones(status);
CREATE INDEX IF NOT EXISTS idx_package_milestones_scheduled ON package_milestones(scheduled_date) WHERE status = 'pending';

-- ============================================================================
-- POST-SERVICE PAYMENTS (Emergency Services)
-- ============================================================================

CREATE TABLE IF NOT EXISTS post_service_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
    payment_method TEXT,
    payment_id UUID,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_service_payments_booking ON post_service_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_post_service_payments_status ON post_service_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_post_service_payments_due_date ON post_service_payments(due_date) WHERE payment_status = 'pending';

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

DO $$
BEGIN
    -- Insurance claims
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_booking_fkey') THEN
        ALTER TABLE insurance_claims ADD CONSTRAINT insurance_claims_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_customer_fkey') THEN
        ALTER TABLE insurance_claims ADD CONSTRAINT insurance_claims_customer_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Subscriptions
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_booking_fkey') THEN
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_customer_fkey') THEN
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_customer_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_vendor_fkey') THEN
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_vendor_fkey
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_deliveries_subscription_fkey') THEN
        ALTER TABLE subscription_deliveries ADD CONSTRAINT subscription_deliveries_subscription_fkey
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_subscription_fkey') THEN
        ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_subscription_fkey
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_payment_fkey') THEN
        ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_payment_fkey
            FOREIGN KEY (payment_id) REFERENCES payments(id);
    END IF;

    -- Adoption applications
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adoption_applications_booking_fkey') THEN
        ALTER TABLE adoption_applications ADD CONSTRAINT adoption_applications_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adoption_applications_customer_fkey') THEN
        ALTER TABLE adoption_applications ADD CONSTRAINT adoption_applications_customer_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Package milestones
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_milestones_booking_fkey') THEN
        ALTER TABLE package_milestones ADD CONSTRAINT package_milestones_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    -- Post-service payments
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_service_payments_booking_fkey') THEN
        ALTER TABLE post_service_payments ADD CONSTRAINT post_service_payments_booking_fkey
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_service_payments_customer_fkey') THEN
        ALTER TABLE post_service_payments ADD CONSTRAINT post_service_payments_customer_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_service_payments_vendor_fkey') THEN
        ALTER TABLE post_service_payments ADD CONSTRAINT post_service_payments_vendor_fkey
            FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION 005
-- ============================================================================


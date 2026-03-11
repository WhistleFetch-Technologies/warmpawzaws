-- ============================================================================
-- MIGRATION 030: Add Missing Tables
-- ============================================================================
-- Adds tables that are referenced by endpoints but missing from schema:
-- - subscription_plans
-- - customer_subscriptions
-- - events
-- - event_registrations
-- - insurance_plans
-- - insurance_policies
-- ============================================================================

-- Subscription Plans (for vendor service subscriptions)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly', 'weekly')),
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_vendor ON subscription_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = true;

-- Customer Subscriptions
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    payment_method_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_vendor ON customer_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);

-- Events (adoption drives, fundraisers, meetups, etc.)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('adoption_drive', 'fundraiser', 'meetup', 'workshop', 'vaccination_camp', 'pet_party', 'other')),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    venue TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    registration_required BOOLEAN DEFAULT true,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    fees NUMERIC(10, 2) DEFAULT 0,
    images JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
    is_featured BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_vendor ON events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- Event Registrations
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id),
    attendee_count INTEGER DEFAULT 1,
    registration_status TEXT NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('registered', 'confirmed', 'cancelled', 'attended', 'no_show')),
    payment_id UUID,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived')),
    notes TEXT,
    check_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(event_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_customer ON event_registrations(customer_id);

-- Insurance Plans
CREATE TABLE IF NOT EXISTS insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    coverage_type TEXT NOT NULL CHECK (coverage_type IN ('basic', 'standard', 'premium', 'comprehensive')),
    monthly_premium NUMERIC(10, 2) NOT NULL,
    coverage_amount NUMERIC(12, 2) NOT NULL,
    deductible NUMERIC(10, 2) DEFAULT 0,
    covered_conditions JSONB DEFAULT '[]',
    exclusions JSONB DEFAULT '[]',
    waiting_period_days INTEGER DEFAULT 30,
    max_pet_age INTEGER DEFAULT 10, -- Max age to purchase
    eligible_species TEXT[] DEFAULT ARRAY['dog', 'cat'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_plans_active ON insurance_plans(is_active) WHERE is_active = true;

-- Insurance Policies (customer purchases)
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number TEXT UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES insurance_plans(id),
    status TEXT NOT NULL DEFAULT 'pending_documents' CHECK (status IN ('pending_documents', 'under_review', 'active', 'expired', 'cancelled', 'claimed')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    premium_amount NUMERIC(10, 2) NOT NULL,
    coverage_amount NUMERIC(12, 2) NOT NULL,
    deductible NUMERIC(10, 2) DEFAULT 0,
    payment_frequency TEXT DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly', 'yearly')),
    next_payment_date DATE,
    documents JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate policy number on insert
CREATE OR REPLACE FUNCTION generate_policy_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.policy_number IS NULL THEN
        NEW.policy_number := 'WP-INS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_policy_number ON insurance_policies;
CREATE TRIGGER set_policy_number
    BEFORE INSERT ON insurance_policies
    FOR EACH ROW
    EXECUTE FUNCTION generate_policy_number();

CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer ON insurance_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_pet ON insurance_policies(pet_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);

-- Insurance Claims
CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    claim_number TEXT UNIQUE,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('accident', 'illness', 'surgery', 'medication', 'diagnostic', 'other')),
    incident_date DATE NOT NULL,
    description TEXT NOT NULL,
    claimed_amount NUMERIC(10, 2) NOT NULL,
    approved_amount NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'partially_approved', 'rejected', 'paid')),
    documents JSONB DEFAULT '[]',
    rejection_reason TEXT,
    processed_by UUID, -- Admin user ID
    processed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payment_reference TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate claim number on insert
CREATE OR REPLACE FUNCTION generate_claim_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.claim_number IS NULL THEN
        NEW.claim_number := 'CLM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_claim_number ON insurance_claims;
CREATE TRIGGER set_claim_number
    BEFORE INSERT ON insurance_claims
    FOR EACH ROW
    EXECUTE FUNCTION generate_claim_number();

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE subscription_plans IS 'Vendor service subscription plans (e.g., monthly grooming packages)';
COMMENT ON TABLE customer_subscriptions IS 'Customer subscriptions to vendor plans';
COMMENT ON TABLE events IS 'Vendor events like adoption drives, meetups, workshops';
COMMENT ON TABLE event_registrations IS 'Customer registrations for events';
COMMENT ON TABLE insurance_plans IS 'Pet insurance plan templates';
COMMENT ON TABLE insurance_policies IS 'Customer pet insurance policies';
COMMENT ON TABLE insurance_claims IS 'Insurance claim submissions';


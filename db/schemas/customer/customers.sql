-- ============================================================================
-- CUSTOMERS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    house_no TEXT,
    profile_photo_url TEXT,
    is_active BOOL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    user_id UUID,
    status TEXT DEFAULT 'new'::text,
    onboarding_status TEXT DEFAULT 'INIT'::text,
    profile_completed BOOL DEFAULT FALSE,
    profile_completed_at TIMESTAMPTZ,
    customer_identity_id UUID,
    name TEXT,
    longitude NUMERIC(11, 8),
    flatNo TEXT,
    houseNo TEXT,
    floor TEXT,
    wing TEXT,
    streetName TEXT,
    latitude NUMERIC(10, 8),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customers ADD CONSTRAINT customers_customer_identity_id_fkey FOREIGN KEY (customer_identity_id) REFERENCES customer_identity(id) ON UPDATE NO ACTION ON DELETE NO ACTION;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customers ADD CONSTRAINT 2200_16542_1_not_null CHECK (...);
-- ALTER TABLE customers ADD CONSTRAINT 2200_16542_2_not_null CHECK (...);
-- ALTER TABLE customers ADD CONSTRAINT 2200_16542_4_not_null CHECK (...);
-- ALTER TABLE customers ADD CONSTRAINT customers_gender_check CHECK (...);
-- ALTER TABLE customers ADD CONSTRAINT customers_onboarding_status_check CHECK (...);
-- ALTER TABLE customers ADD CONSTRAINT customers_status_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customers_phone_key ON public.customers USING btree (phone);
CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);
CREATE INDEX idx_customers_identity_id ON public.customers USING btree (customer_identity_id);
CREATE INDEX idx_customers_onboarding_status ON public.customers USING btree (onboarding_status);
CREATE INDEX idx_customers_profile_completed ON public.customers USING btree (profile_completed) WHERE (profile_completed = false);
CREATE INDEX idx_customers_status ON public.customers USING btree (status);
CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customers IS 'Customer profiles - maps from customer:{id} KV keys';
COMMENT ON COLUMN customers.phone IS 'Primary identifier from UI form';
COMMENT ON COLUMN customers.full_name IS 'From CustomerUserProfile form';
COMMENT ON COLUMN customers.user_id IS 'UUID reference to user account - used for authentication';
COMMENT ON COLUMN customers.status IS 'Customer account status: new, onboarding, active, inactive, suspended';
COMMENT ON COLUMN customers.onboarding_status IS 'Customer onboarding state: INIT, PHONE_VERIFIED, PROFILE_PENDING, PET_PENDING, PREFERENCES_PENDING, COMPLETED';
COMMENT ON COLUMN customers.profile_completed IS 'Whether customer has completed their profile (name, email, address, etc.)';
COMMENT ON COLUMN customers.profile_completed_at IS 'Timestamp when profile was completed';
COMMENT ON COLUMN customers.customer_identity_id IS 'Reference to customer_identity table for OTP/auth state';
COMMENT ON COLUMN customers.name IS 'Customer name (synonym for full_name)';
COMMENT ON COLUMN customers.longitude IS 'Longitude coordinate for customer address';
COMMENT ON COLUMN customers.house_no IS 'House or flat number (snake_case; preferred for API/Lambda)';
COMMENT ON COLUMN customers.flatNo IS 'Flat number for customer address';
COMMENT ON COLUMN customers.houseNo IS 'Legacy house number (stored as houseno in PostgreSQL)';
COMMENT ON COLUMN customers.floor IS 'Floor number for customer address';
COMMENT ON COLUMN customers.wing IS 'Wing/building section for customer address';
COMMENT ON COLUMN customers.streetName IS 'Street name for customer address';
COMMENT ON COLUMN customers.latitude IS 'Latitude coordinate for customer address';


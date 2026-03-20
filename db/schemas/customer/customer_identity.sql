-- ============================================================================
-- CUSTOMER_IDENTITY TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_identity (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT,
    onboarding_status TEXT NOT NULL DEFAULT 'INIT'::text,
    current_step TEXT,
    customer_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_identity ADD CONSTRAINT customer_identity_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_identity ADD CONSTRAINT customer_identity_phone_key UNIQUE (phone);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_identity ADD CONSTRAINT 2200_32957_1_not_null CHECK (...);
-- ALTER TABLE customer_identity ADD CONSTRAINT 2200_32957_2_not_null CHECK (...);
-- ALTER TABLE customer_identity ADD CONSTRAINT 2200_32957_4_not_null CHECK (...);
-- ALTER TABLE customer_identity ADD CONSTRAINT customer_identity_onboarding_status_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_identity_phone_key ON public.customer_identity USING btree (phone);
CREATE UNIQUE INDEX customer_identity_pkey ON public.customer_identity USING btree (id);
CREATE INDEX idx_customer_identity_customer ON public.customer_identity USING btree (customer_id);
CREATE INDEX idx_customer_identity_phone ON public.customer_identity USING btree (phone);
CREATE INDEX idx_customer_identity_status ON public.customer_identity USING btree (onboarding_status);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_identity IS 'Customer identity and onboarding state - tracks OTP/auth and onboarding progress';
COMMENT ON COLUMN customer_identity.onboarding_status IS 'Current onboarding state';
COMMENT ON COLUMN customer_identity.current_step IS 'Current step in onboarding flow';


-- ============================================================================
-- CUSTOMER_PROFILE_COMPLETION TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_profile_completion (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    basic_info_completed BOOL DEFAULT FALSE,
    address_completed BOOL DEFAULT FALSE,
    pet_profile_completed BOOL DEFAULT FALSE,
    preferences_completed BOOL DEFAULT FALSE,
    basic_info_completed_at TIMESTAMPTZ,
    address_completed_at TIMESTAMPTZ,
    pet_profile_completed_at TIMESTAMPTZ,
    preferences_completed_at TIMESTAMPTZ,
    is_profile_complete BOOL DEFAULT FALSE,
    profile_completed_at TIMESTAMPTZ,
    completion_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_profile_completion ADD CONSTRAINT customer_profile_completion_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_profile_completion ADD CONSTRAINT customer_profile_completion_customer_id_key UNIQUE (customer_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_profile_completion ADD CONSTRAINT 2200_32986_1_not_null CHECK (...);
-- ALTER TABLE customer_profile_completion ADD CONSTRAINT 2200_32986_2_not_null CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_profile_completion_customer_id_key ON public.customer_profile_completion USING btree (customer_id);
CREATE UNIQUE INDEX customer_profile_completion_pkey ON public.customer_profile_completion USING btree (id);
CREATE INDEX idx_customer_profile_completion_complete ON public.customer_profile_completion USING btree (is_profile_complete);
CREATE INDEX idx_customer_profile_completion_customer ON public.customer_profile_completion USING btree (customer_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_profile_completion IS 'Tracks customer profile completion status - gates full platform access';


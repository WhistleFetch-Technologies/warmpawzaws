-- ============================================================================
-- CANCELLATION_POLICIES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cancellation_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    description TEXT,
    hours_before_booking INTEGER NOT NULL,
    cancellation_fee_percentage NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE cancellation_policies ADD CONSTRAINT cancellation_policies_policy_name_key UNIQUE (policy_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE cancellation_policies ADD CONSTRAINT cancellation_policies_cancellation_fee_percentage_check CHECK (cancellation_fee_percentage BETWEEN 0 AND 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX cancellation_policies_pkey ON public.cancellation_policies USING btree (id);
CREATE UNIQUE INDEX cancellation_policies_policy_name_key ON public.cancellation_policies USING btree (policy_name);
CREATE INDEX idx_cancellation_policies_active ON public.cancellation_policies USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cancellation_policies IS 'Cancellation policies - maps from platform:cancellation_policies KV key';
COMMENT ON COLUMN cancellation_policies.policy_name IS 'Policy name (unique)';
COMMENT ON COLUMN cancellation_policies.description IS 'Policy description';
COMMENT ON COLUMN cancellation_policies.hours_before_booking IS 'Hours before booking for this policy';
COMMENT ON COLUMN cancellation_policies.cancellation_fee_percentage IS 'Cancellation fee percentage (0-100)';

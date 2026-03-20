-- ============================================================================
-- PAYOUT_RULES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS payout_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    min_payout_amount NUMERIC(10, 2) NOT NULL,
    processing_days INTEGER NOT NULL DEFAULT 3,
    fee_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE payout_rules ADD CONSTRAINT payout_rules_rule_name_key UNIQUE (rule_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE payout_rules ADD CONSTRAINT payout_rules_fee_percentage_check CHECK (fee_percentage >= 0 AND fee_percentage <= 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX payout_rules_pkey ON public.payout_rules USING btree (id);
CREATE UNIQUE INDEX payout_rules_rule_name_key ON public.payout_rules USING btree (rule_name);
CREATE INDEX idx_payout_rules_active ON public.payout_rules USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payout_rules IS 'Payout rules - maps from admin:settings:payout_rules, admin:payout:policies KV keys';
COMMENT ON COLUMN payout_rules.rule_name IS 'Rule name (unique)';
COMMENT ON COLUMN payout_rules.min_payout_amount IS 'Minimum payout amount';
COMMENT ON COLUMN payout_rules.processing_days IS 'Processing days';
COMMENT ON COLUMN payout_rules.fee_percentage IS 'Fee percentage (0-100)';

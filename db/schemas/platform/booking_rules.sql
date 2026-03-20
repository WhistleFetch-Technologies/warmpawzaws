-- ============================================================================
-- BOOKING_RULES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE booking_rules ADD CONSTRAINT booking_rules_rule_name_key UNIQUE (rule_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE booking_rules ADD CONSTRAINT booking_rules_rule_type_check CHECK (rule_type IN ('advance_booking', 'cancellation', 'rescheduling', 'payment', 'other'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX booking_rules_pkey ON public.booking_rules USING btree (id);
CREATE UNIQUE INDEX booking_rules_rule_name_key ON public.booking_rules USING btree (rule_name);
CREATE INDEX idx_booking_rules_type ON public.booking_rules USING btree (rule_type);
CREATE INDEX idx_booking_rules_active ON public.booking_rules USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE booking_rules IS 'Booking rules - maps from admin:booking_rules KV key';
COMMENT ON COLUMN booking_rules.rule_name IS 'Rule name (unique)';
COMMENT ON COLUMN booking_rules.rule_type IS 'Rule type: advance_booking, cancellation, rescheduling, payment, other';
COMMENT ON COLUMN booking_rules.rule_config IS 'Rule configuration (JSONB)';

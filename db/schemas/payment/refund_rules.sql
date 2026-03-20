-- ============================================================================
-- REFUND_RULES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS refund_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE refund_rules ADD CONSTRAINT refund_rules_rule_type_check CHECK (rule_type IN ('time_based', 'status_based', 'amount_based', 'custom'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX refund_rules_pkey ON public.refund_rules USING btree (id);
CREATE INDEX idx_refund_rules_type ON public.refund_rules USING btree (rule_type);
CREATE INDEX idx_refund_rules_active ON public.refund_rules USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE refund_rules IS 'Refund rules - maps from payment:refund_rules, admin:refund_policies KV keys';
COMMENT ON COLUMN refund_rules.name IS 'Rule name';
COMMENT ON COLUMN refund_rules.description IS 'Rule description';
COMMENT ON COLUMN refund_rules.rule_type IS 'Rule type: time_based, status_based, amount_based, custom';
COMMENT ON COLUMN refund_rules.rule_config IS 'Rule configuration (JSONB)';
COMMENT ON COLUMN refund_rules.is_active IS 'Whether rule is active';

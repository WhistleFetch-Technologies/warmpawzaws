-- ============================================================================
-- LOYALTY_RULES TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    points_per_rupee NUMERIC(5, 2) NOT NULL,
    redemption_rate NUMERIC(5, 2) NOT NULL,
    min_redemption_points INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT loyalty_rules_rule_name_key UNIQUE (rule_name)
);

CREATE UNIQUE INDEX loyalty_rules_pkey ON loyalty_rules(id);
CREATE UNIQUE INDEX loyalty_rules_rule_name_key ON loyalty_rules(rule_name);
CREATE INDEX idx_loyalty_rules_active ON loyalty_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE loyalty_rules IS 'Loyalty rules - maps from loyalty_rules KV key';
COMMENT ON COLUMN loyalty_rules.redemption_rate IS 'Points per rupee for redemption';

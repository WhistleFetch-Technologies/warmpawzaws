-- ============================================================================
-- REFUND_TIERS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS refund_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL,
    min_hours_before_booking INTEGER,
    refund_percentage NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE refund_tiers ADD CONSTRAINT refund_tiers_tier_name_key UNIQUE (tier_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE refund_tiers ADD CONSTRAINT refund_tiers_refund_percentage_check CHECK (refund_percentage BETWEEN 0 AND 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX refund_tiers_pkey ON public.refund_tiers USING btree (id);
CREATE UNIQUE INDEX refund_tiers_tier_name_key ON public.refund_tiers USING btree (tier_name);
CREATE INDEX idx_refund_tiers_active ON public.refund_tiers USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE refund_tiers IS 'Refund tiers - maps from admin:refund_tiers, payment:tiers KV keys';
COMMENT ON COLUMN refund_tiers.tier_name IS 'Tier name (unique)';
COMMENT ON COLUMN refund_tiers.min_hours_before_booking IS 'Minimum hours before booking for this tier';
COMMENT ON COLUMN refund_tiers.refund_percentage IS 'Refund percentage (0-100)';
COMMENT ON COLUMN refund_tiers.is_active IS 'Whether tier is active';

-- ============================================================================
-- PLATFORM_REVENUE TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_revenue (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    revenue_date DATE NOT NULL,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    commission_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    transaction_fees NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE platform_revenue ADD CONSTRAINT platform_revenue_revenue_date_key UNIQUE (revenue_date);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX platform_revenue_pkey ON public.platform_revenue USING btree (id);
CREATE UNIQUE INDEX platform_revenue_revenue_date_key ON public.platform_revenue USING btree (revenue_date);
CREATE INDEX idx_platform_revenue_date ON public.platform_revenue USING btree (revenue_date DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE platform_revenue IS 'Platform revenue - maps from platform:revenue KV key';
COMMENT ON COLUMN platform_revenue.revenue_date IS 'Revenue date (unique)';
COMMENT ON COLUMN platform_revenue.total_revenue IS 'Total revenue';
COMMENT ON COLUMN platform_revenue.commission_revenue IS 'Commission revenue';
COMMENT ON COLUMN platform_revenue.transaction_fees IS 'Transaction fees';

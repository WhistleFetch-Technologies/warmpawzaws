-- ============================================================================
-- CUSTOMER_LOYALTY_POINTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_loyalty_points (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    total_points INT4 DEFAULT 0,
    lifetime_points_earned INT4 DEFAULT 0,
    lifetime_points_redeemed INT4 DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_loyalty_points ADD CONSTRAINT customer_loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE NO ACTION;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_loyalty_points ADD CONSTRAINT customer_loyalty_points_customer_id_key UNIQUE (customer_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_loyalty_points ADD CONSTRAINT 2200_17313_1_not_null CHECK (...);
-- ALTER TABLE customer_loyalty_points ADD CONSTRAINT 2200_17313_2_not_null CHECK (...);
-- ALTER TABLE customer_loyalty_points ADD CONSTRAINT customer_loyalty_points_total_points_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_loyalty_points_customer_id_key ON public.customer_loyalty_points USING btree (customer_id);
CREATE UNIQUE INDEX customer_loyalty_points_pkey ON public.customer_loyalty_points USING btree (id);


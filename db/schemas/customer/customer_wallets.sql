-- ============================================================================
-- CUSTOMER_WALLETS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_wallets (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE NO ACTION;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_id_key UNIQUE (customer_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_wallets ADD CONSTRAINT 2200_16819_1_not_null CHECK (...);
-- ALTER TABLE customer_wallets ADD CONSTRAINT 2200_16819_2_not_null CHECK (...);
-- ALTER TABLE customer_wallets ADD CONSTRAINT 2200_16819_3_not_null CHECK (...);
-- ALTER TABLE customer_wallets ADD CONSTRAINT check_wallet_balance_non_negative CHECK (...);
-- ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_balance_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_wallets_customer_id_key ON public.customer_wallets USING btree (customer_id);
CREATE UNIQUE INDEX customer_wallets_pkey ON public.customer_wallets USING btree (id);


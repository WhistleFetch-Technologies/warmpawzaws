-- ============================================================================
-- LOYALTY_TRANSACTIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,
    points INT4 NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_transaction_type_check CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX loyalty_transactions_pkey ON public.loyalty_transactions USING btree (id);
CREATE INDEX idx_loyalty_transactions_customer ON public.loyalty_transactions USING btree (customer_id);
CREATE INDEX idx_loyalty_transactions_type ON public.loyalty_transactions USING btree (transaction_type);
CREATE INDEX idx_loyalty_transactions_reference ON public.loyalty_transactions USING btree (reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_loyalty_transactions_expires ON public.loyalty_transactions USING btree (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_loyalty_transactions_created ON public.loyalty_transactions USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE loyalty_transactions IS 'Loyalty points transaction history - tracks points earned, redeemed, expired, and adjusted';
COMMENT ON COLUMN loyalty_transactions.customer_id IS 'Customer who earned/redeemed the points';
COMMENT ON COLUMN loyalty_transactions.transaction_type IS 'Type of transaction: earned, redeemed, expired, adjusted';
COMMENT ON COLUMN loyalty_transactions.points IS 'Number of points (positive for earned, negative for redeemed)';
COMMENT ON COLUMN loyalty_transactions.reference_type IS 'Type of reference: booking, payment, promotion, etc.';
COMMENT ON COLUMN loyalty_transactions.reference_id IS 'ID of the referenced entity (booking_id, payment_id, etc.)';
COMMENT ON COLUMN loyalty_transactions.expires_at IS 'Expiration date for earned points (if applicable)';

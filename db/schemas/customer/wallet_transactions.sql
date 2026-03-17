-- ============================================================================
-- WALLET_TRANSACTIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    payment_id UUID,
    booking_id UUID,
    order_id UUID,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_type_check CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX wallet_transactions_pkey ON public.wallet_transactions USING btree (id);
CREATE INDEX idx_wallet_transactions_customer ON public.wallet_transactions USING btree (customer_id);
CREATE INDEX idx_wallet_transactions_created ON public.wallet_transactions USING btree (created_at DESC);
CREATE INDEX idx_wallet_transactions_payment ON public.wallet_transactions USING btree (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_booking ON public.wallet_transactions USING btree (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_order ON public.wallet_transactions USING btree (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_reference ON public.wallet_transactions USING btree (reference_type, reference_id) WHERE reference_type IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wallet_transactions IS 'Wallet transaction history - tracks all wallet credits, debits, refunds, and payouts';
COMMENT ON COLUMN wallet_transactions.customer_id IS 'Customer who owns the wallet';
COMMENT ON COLUMN wallet_transactions.transaction_type IS 'Type of transaction: credit, debit, refund, payout';
COMMENT ON COLUMN wallet_transactions.amount IS 'Transaction amount (positive for credit, negative for debit)';
COMMENT ON COLUMN wallet_transactions.balance_after IS 'Wallet balance after this transaction';
COMMENT ON COLUMN wallet_transactions.payment_id IS 'Reference to payment if transaction is related to a payment';
COMMENT ON COLUMN wallet_transactions.booking_id IS 'Reference to booking if transaction is related to a booking';
COMMENT ON COLUMN wallet_transactions.order_id IS 'Reference to order if transaction is related to an order';
COMMENT ON COLUMN wallet_transactions.reference_type IS 'Type of reference: payment, refund, topup, etc.';
COMMENT ON COLUMN wallet_transactions.reference_id IS 'ID of the referenced entity';

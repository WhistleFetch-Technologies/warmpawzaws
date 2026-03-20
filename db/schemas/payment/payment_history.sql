-- ============================================================================
-- PAYMENT_HISTORY TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    vendor_id UUID,
    amount NUMERIC(10, 2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE payment_history ADD CONSTRAINT payment_history_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE payment_history ADD CONSTRAINT payment_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE payment_history ADD CONSTRAINT payment_history_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX payment_history_pkey ON public.payment_history USING btree (id);
CREATE INDEX idx_payment_history_payment_id ON public.payment_history USING btree (payment_id);
CREATE INDEX idx_payment_history_customer_id ON public.payment_history USING btree (customer_id);
CREATE INDEX idx_payment_history_vendor_id ON public.payment_history USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_payment_history_date ON public.payment_history USING btree (payment_date DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_history IS 'Payment history (denormalized for quick access) - maps from customer:{id}:payments, vendor:{id}:payments KV keys';
COMMENT ON COLUMN payment_history.payment_id IS 'Reference to payments table';
COMMENT ON COLUMN payment_history.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN payment_history.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN payment_history.amount IS 'Payment amount';
COMMENT ON COLUMN payment_history.payment_date IS 'Payment date';

-- ============================================================================
-- REFUNDS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS refunds (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL,
    booking_id UUID,
    customer_id UUID NOT NULL,
    vendor_id UUID,
    refund_amount NUMERIC(10, 2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_status TEXT NOT NULL DEFAULT 'pending',
    razorpay_refund_id TEXT,
    requested_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE refunds ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE refunds ADD CONSTRAINT refunds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE refunds ADD CONSTRAINT refunds_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE refunds ADD CONSTRAINT refunds_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE refunds ADD CONSTRAINT refunds_refund_status_check CHECK (refund_status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX refunds_pkey ON public.refunds USING btree (id);
CREATE INDEX idx_refunds_payment_id ON public.refunds USING btree (payment_id);
CREATE INDEX idx_refunds_customer_id ON public.refunds USING btree (customer_id);
CREATE INDEX idx_refunds_vendor_id ON public.refunds USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_refunds_status ON public.refunds USING btree (refund_status);
CREATE INDEX idx_refunds_created_at ON public.refunds USING btree (requested_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE refunds IS 'Refunds - maps from refund:{id} KV keys';
COMMENT ON COLUMN refunds.payment_id IS 'Reference to payments table';
COMMENT ON COLUMN refunds.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN refunds.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN refunds.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN refunds.refund_amount IS 'Refund amount';
COMMENT ON COLUMN refunds.refund_reason IS 'Reason for refund';
COMMENT ON COLUMN refunds.refund_status IS 'Refund status: pending, approved, processing, completed, rejected, failed';
COMMENT ON COLUMN refunds.razorpay_refund_id IS 'Razorpay refund ID';

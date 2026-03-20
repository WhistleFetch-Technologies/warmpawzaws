-- ============================================================================
-- PAYMENTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id UUID,
    order_id UUID,
    customer_id UUID NOT NULL,
    vendor_id UUID,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    coupon_code TEXT,
    promotion_id UUID,
    loyalty_points_used INTEGER DEFAULT 0,
    wallet_amount_used NUMERIC(10, 2) DEFAULT 0,
    transaction_id TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE payments ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking'));
ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);
CREATE INDEX idx_payments_customer_id ON public.payments USING btree (customer_id);
CREATE INDEX idx_payments_vendor_id ON public.payments USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_payments_booking_id ON public.payments USING btree (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_payments_status ON public.payments USING btree (payment_status);
CREATE INDEX idx_payments_razorpay_payment_id ON public.payments USING btree (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payments IS 'Payments - maps from payment:{id} KV keys';
COMMENT ON COLUMN payments.booking_id IS 'Reference to bookings table (if payment is for booking)';
COMMENT ON COLUMN payments.order_id IS 'Reference to orders table (if payment is for order)';
COMMENT ON COLUMN payments.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN payments.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: razorpay, wallet, cash, card, upi, netbanking';
COMMENT ON COLUMN payments.payment_status IS 'Payment status: pending, processing, completed, failed, refunded, partially_refunded';
COMMENT ON COLUMN payments.razorpay_order_id IS 'Razorpay order ID';
COMMENT ON COLUMN payments.razorpay_payment_id IS 'Razorpay payment ID';

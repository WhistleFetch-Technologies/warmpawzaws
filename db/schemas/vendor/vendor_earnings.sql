-- ============================================================================
-- VENDOR_EARNINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_earnings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    booking_id UUID NOT NULL,
    settlement_id UUID,
    payout_id UUID,
    amount NUMERIC(10, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    realized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_out_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_earnings ADD CONSTRAINT vendor_earnings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE vendor_earnings ADD CONSTRAINT vendor_earnings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE vendor_earnings ADD CONSTRAINT vendor_earnings_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE vendor_earnings ADD CONSTRAINT vendor_earnings_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_earnings ADD CONSTRAINT vendor_earnings_status_check CHECK (status IN ('pending', 'settled', 'paid_out', 'cancelled'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_earnings_pkey ON public.vendor_earnings USING btree (id);
CREATE INDEX idx_vendor_earnings_vendor_id ON public.vendor_earnings USING btree (vendor_id);
CREATE INDEX idx_vendor_earnings_booking_id ON public.vendor_earnings USING btree (booking_id);
CREATE INDEX idx_vendor_earnings_settlement_id ON public.vendor_earnings USING btree (settlement_id) WHERE settlement_id IS NOT NULL;
CREATE INDEX idx_vendor_earnings_payout_id ON public.vendor_earnings USING btree (payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX idx_vendor_earnings_status ON public.vendor_earnings USING btree (status);
CREATE INDEX idx_vendor_earnings_vendor_status ON public.vendor_earnings USING btree (vendor_id, status);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_earnings IS 'Vendor earnings per booking - replaces earnings:{id} KV keys';
COMMENT ON COLUMN vendor_earnings.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_earnings.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN vendor_earnings.settlement_id IS 'Reference to settlements table (if settled)';
COMMENT ON COLUMN vendor_earnings.payout_id IS 'Reference to payouts table (if paid out)';
COMMENT ON COLUMN vendor_earnings.amount IS 'Vendor earnings amount (after commission)';
COMMENT ON COLUMN vendor_earnings.commission_amount IS 'Platform commission amount';
COMMENT ON COLUMN vendor_earnings.total_amount IS 'Total booking amount';
COMMENT ON COLUMN vendor_earnings.commission_rate IS 'Commission rate percentage';
COMMENT ON COLUMN vendor_earnings.status IS 'Earnings status: pending, settled, paid_out, cancelled';
COMMENT ON COLUMN vendor_earnings.realized_at IS 'When earnings were realized (settled)';
COMMENT ON COLUMN vendor_earnings.paid_out_at IS 'When earnings were paid out';

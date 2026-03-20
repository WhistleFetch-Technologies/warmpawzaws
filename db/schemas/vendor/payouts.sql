-- ============================================================================
-- PAYOUTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS payouts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    razorpay_payout_id TEXT,
    bank_account_id UUID,
    settlement_ids UUID[] NOT NULL DEFAULT '{}',
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE payouts ADD CONSTRAINT payouts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX payouts_pkey ON public.payouts USING btree (id);
CREATE INDEX idx_payouts_vendor_id ON public.payouts USING btree (vendor_id);
CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);
CREATE INDEX idx_payouts_scheduled_at ON public.payouts USING btree (scheduled_at);
CREATE INDEX idx_payouts_vendor_status ON public.payouts USING btree (vendor_id, status);
CREATE INDEX idx_payouts_razorpay_id ON public.payouts USING btree (razorpay_payout_id) WHERE razorpay_payout_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payouts IS 'Vendor payouts - replaces payout:{id} KV keys';
COMMENT ON COLUMN payouts.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN payouts.amount IS 'Payout amount';
COMMENT ON COLUMN payouts.currency IS 'Currency (default: INR)';
COMMENT ON COLUMN payouts.status IS 'Payout status: scheduled, processing, completed, failed, cancelled';
COMMENT ON COLUMN payouts.scheduled_at IS 'When payout is scheduled';
COMMENT ON COLUMN payouts.processed_at IS 'When payout was processed';
COMMENT ON COLUMN payouts.razorpay_payout_id IS 'Razorpay payout ID';
COMMENT ON COLUMN payouts.bank_account_id IS 'Bank account ID for payout';
COMMENT ON COLUMN payouts.settlement_ids IS 'Array of settlement IDs included in this payout';
COMMENT ON COLUMN payouts.failure_reason IS 'Reason for failure if payout failed';

-- ============================================================================
-- SETTLEMENTS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlements (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2) NOT NULL,
    settlement_status TEXT NOT NULL DEFAULT 'pending',
    settlement_period_start DATE NOT NULL,
    settlement_period_end DATE NOT NULL,
    payment_ids UUID[] NOT NULL DEFAULT '{}',
    payout_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE settlements ADD CONSTRAINT settlements_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE settlements ADD CONSTRAINT settlements_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE settlements ADD CONSTRAINT settlements_settlement_status_check CHECK (settlement_status IN ('pending', 'processing', 'completed', 'failed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX settlements_pkey ON public.settlements USING btree (id);
CREATE INDEX idx_settlements_vendor_id ON public.settlements USING btree (vendor_id);
CREATE INDEX idx_settlements_status ON public.settlements USING btree (settlement_status);
CREATE INDEX idx_settlements_period ON public.settlements USING btree (settlement_period_start, settlement_period_end);
CREATE INDEX idx_settlements_payout_id ON public.settlements USING btree (payout_id) WHERE payout_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE settlements IS 'Settlements - maps from pending_settlements, admin:settlements:pending KV keys';
COMMENT ON COLUMN settlements.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN settlements.total_amount IS 'Total amount before commission';
COMMENT ON COLUMN settlements.commission_amount IS 'Platform commission amount';
COMMENT ON COLUMN settlements.net_amount IS 'Net amount to vendor (total - commission)';
COMMENT ON COLUMN settlements.settlement_status IS 'Settlement status: pending, processing, completed, failed';
COMMENT ON COLUMN settlements.settlement_period_start IS 'Settlement period start date';
COMMENT ON COLUMN settlements.settlement_period_end IS 'Settlement period end date';
COMMENT ON COLUMN settlements.payment_ids IS 'Array of payment IDs included in this settlement';
COMMENT ON COLUMN settlements.payout_id IS 'Reference to payouts table (if paid out)';

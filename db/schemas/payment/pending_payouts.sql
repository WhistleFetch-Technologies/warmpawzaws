-- ============================================================================
-- PENDING_PAYOUTS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_payouts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    queued_at TIMESTAMPTZ DEFAULT now(),
    priority INTEGER DEFAULT 5,
    PRIMARY KEY (id)
);

ALTER TABLE pending_payouts ADD CONSTRAINT pending_payouts_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE;
ALTER TABLE pending_payouts ADD CONSTRAINT pending_payouts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX pending_payouts_pkey ON pending_payouts(id);
CREATE INDEX idx_pending_payouts_payout_id ON pending_payouts(payout_id);
CREATE INDEX idx_pending_payouts_vendor_id ON pending_payouts(vendor_id);
CREATE INDEX idx_pending_payouts_priority ON pending_payouts(priority);

COMMENT ON TABLE pending_payouts IS 'Pending payouts queue - maps from payouts:pending KV key';

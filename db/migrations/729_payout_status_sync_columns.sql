-- Payout reconciliation: UTR from Razorpay GET /v1/payouts/:id and sync cursor.
-- Does not alter payout_status CHECK constraints.

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_utr TEXT NULL;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN payouts.payout_utr IS 'Bank UTR from Razorpay payout entity when available';
COMMENT ON COLUMN payouts.last_synced_at IS 'Last successful Razorpay payout fetch for reconciliation';

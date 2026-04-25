-- Align payouts with settlement/payout code paths (claimPayoutForProcessing, process-payouts).
-- Fixes: column "updated_at" of relation "payouts" does not exist (e.g. POST /settlements/calculate-daily → createPayout).

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE payouts
SET updated_at = COALESCE(processed_at, completed_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE payouts ALTER COLUMN updated_at SET DEFAULT NOW();

COMMENT ON COLUMN payouts.updated_at IS 'Last mutation to this payout row (status, Razorpay id, failure_reason, etc.).';

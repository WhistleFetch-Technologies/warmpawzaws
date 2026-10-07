-- refunds.idempotency_key was defined in 046 but never applied on prod.
-- refund-captured-payment.ts writes it (wp-refund-<payment_id>) so a retried refund
-- cannot be recorded twice. Additive + idempotent.

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_idempotency
  ON refunds (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN refunds.idempotency_key IS 'Prevents duplicate refund requests';

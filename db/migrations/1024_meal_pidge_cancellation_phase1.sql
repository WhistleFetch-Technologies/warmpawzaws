-- Phase 1: Pidge hyperlocal meal cancellation attribution, webhook archive, idempotency.

ALTER TABLE meal_orders
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(40);

COMMENT ON COLUMN meal_orders.cancelled_by IS
  'Who cancelled: customer, vendor, admin, system_pidge, system_payment_hold, etc.';

CREATE TABLE IF NOT EXISTS pidge_hyperlocal_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pidge_order_id VARCHAR(255) NOT NULL,
    event_kind VARCHAR(40) NOT NULL,
    idempotency_key VARCHAR(512) NOT NULL,
    meal_order_id UUID REFERENCES meal_orders(id) ON DELETE SET NULL,
    delivery_tracking_id UUID REFERENCES delivery_tracking(id) ON DELETE SET NULL,
    normalized_status VARCHAR(40),
    parent_status VARCHAR(80),
    fulfillment_status VARCHAR(80),
    cancellation_reason TEXT,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pidge_hyperlocal_webhook_events_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pidge_hyperlocal_webhook_pidge_order
    ON pidge_hyperlocal_webhook_events (pidge_order_id);

CREATE INDEX IF NOT EXISTS idx_pidge_hyperlocal_webhook_meal_order
    ON pidge_hyperlocal_webhook_events (meal_order_id)
    WHERE meal_order_id IS NOT NULL;

COMMENT ON TABLE pidge_hyperlocal_webhook_events IS
    'Idempotent archive of Pidge hyperlocal webhooks (e.g. meal logistics cancel); payload retained for ops/disputes.';

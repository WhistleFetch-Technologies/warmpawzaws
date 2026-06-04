-- Phase 2: Meal refund review cases (Pidge logistics cancel, review-only — no Razorpay execution).

CREATE TABLE IF NOT EXISTS meal_refund_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_order_id UUID NOT NULL REFERENCES meal_orders(id) ON DELETE CASCADE,
    pidge_order_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'approved', 'rejected', 'refunded')),
    cancellation_source TEXT,
    cancellation_reason TEXT,
    recommended_refund_amount NUMERIC(12, 2),
    recommendation_reason TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    pidge_webhook_event_id UUID REFERENCES pidge_hyperlocal_webhook_events(id) ON DELETE SET NULL,
    notification_dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT meal_refund_cases_meal_order_id_unique UNIQUE (meal_order_id),
    CONSTRAINT meal_refund_cases_notification_dedupe_key_unique UNIQUE (notification_dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_meal_refund_cases_status
    ON meal_refund_cases (status);

CREATE INDEX IF NOT EXISTS idx_meal_refund_cases_created_at
    ON meal_refund_cases (created_at DESC);

COMMENT ON TABLE meal_refund_cases IS
    'Admin review queue for meal order refunds after Pidge logistics cancellation; status approved/rejected does not execute payment refunds.';

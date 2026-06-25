-- Meal rider reassign audit (Support CRM → Pidge unallocate → webhook sync)
CREATE TABLE IF NOT EXISTS meal_rider_reassign_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_order_id UUID NOT NULL REFERENCES meal_orders(id),
    delivery_tracking_id UUID REFERENCES delivery_tracking(id) ON DELETE SET NULL,
    pidge_order_id VARCHAR(255),
    requested_by_admin_id TEXT,
    support_ticket_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    previous_rider_name VARCHAR(200),
    previous_rider_phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT meal_rider_reassign_requests_status_check CHECK (
        status IN ('pending', 'completed', 'failed', 'superseded')
    )
);

CREATE INDEX IF NOT EXISTS idx_meal_rider_reassign_meal_order
    ON meal_rider_reassign_requests (meal_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_rider_reassign_pending
    ON meal_rider_reassign_requests (meal_order_id)
    WHERE status = 'pending';

COMMENT ON TABLE meal_rider_reassign_requests IS
    'Audit trail when admin triggers Pidge fulfillment unallocate for meal hyperlocal reassign.';

-- Pidge partial delivery: forward DELIVERED + return_order_info → return leg until RTO_DELIVERED

CREATE TABLE IF NOT EXISTS pidge_partial_delivery_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_pidge_order_id VARCHAR(255) NOT NULL,
    return_pidge_order_id VARCHAR(255),
    reference_id VARCHAR(255),
    meal_order_id UUID,
    pharmacy_order_id UUID,
    delivery_tracking_id UUID,
    shipment_id UUID,
    workflow_status VARCHAR(40) NOT NULL DEFAULT 'forward_delivered',
    return_order_info JSONB,
    last_webhook_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT pidge_partial_delivery_workflows_original_key UNIQUE (original_pidge_order_id)
);

CREATE INDEX IF NOT EXISTS idx_pidge_partial_delivery_return_order
    ON pidge_partial_delivery_workflows (return_pidge_order_id)
    WHERE return_pidge_order_id IS NOT NULL;

COMMENT ON TABLE pidge_partial_delivery_workflows IS
    'Tracks Pidge partial delivery: original DELIVERED with return_order_info until return leg RTO_DELIVERED';

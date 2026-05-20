-- Pidge Ticket Management — inbound webhook status updates (delivery-service POST /webhooks/pidge/ticket)

CREATE TABLE IF NOT EXISTS pidge_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(128) NOT NULL,
    pidge_order_id VARCHAR(255),
    issue_category VARCHAR(64),
    issue_subcategory VARCHAR(128),
    description TEXT,
    status VARCHAR(32) NOT NULL,
    order_status VARCHAR(64),
    callback_url TEXT,
    poc_number VARCHAR(32),
    poc_email VARCHAR(255),
    meal_order_id UUID,
    pharmacy_order_id UUID,
    delivery_tracking_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    pidge_created_at TIMESTAMPTZ,
    pidge_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pidge_support_tickets_ticket_id_key UNIQUE (ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_pidge_support_tickets_pidge_order
    ON pidge_support_tickets (pidge_order_id)
    WHERE pidge_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pidge_support_tickets_status
    ON pidge_support_tickets (status);

COMMENT ON TABLE pidge_support_tickets IS 'Pidge issue/ticket webhook snapshots; ticket_id is Pidge external id';

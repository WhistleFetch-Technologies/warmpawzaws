-- ============================================================================
-- MIGRATION 633: delivery_tracking + delivery_location_history (prod parity)
-- ============================================================================
-- Date: 2026-04-09
-- Problem: GET /pharmacy/:id/orders fails with relation "delivery_tracking" does not exist
-- Notes:
--   - meal_order_id has NO FK: prod may not have meal_orders yet (migration 200 partial).
--   - status is VARCHAR(50) without strict CHECK (app uses cancelled, created, pending_assignment, etc.).
--   - Includes metadata JSONB + logistics columns used by logistics.ts / logistics-webhooks.ts.
-- Run via psql or RDS Data API (one statement per execute-statement call).
-- See: scripts/sql-prod-delivery-tracking/run-prod-rds-data.ps1
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_order_id UUID REFERENCES pharmacy_orders(id),
    meal_order_id UUID,
    logistics_partner_id UUID REFERENCES vendors(id),
    delivery_person_name VARCHAR(200),
    delivery_person_phone VARCHAR(20),
    delivery_person_photo TEXT,
    vehicle_number VARCHAR(20),
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    last_location_update TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'assigned',
    eta_to_pickup_minutes INTEGER,
    eta_to_delivery_minutes INTEGER,
    distance_remaining_km NUMERIC(5,2),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    reached_pickup_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    delivery_photo TEXT,
    recipient_name VARCHAR(200),
    delivery_notes TEXT,
    delivery_otp VARCHAR(6),
    otp_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    external_task_id VARCHAR(255),
    logistics_partner VARCHAR(50) DEFAULT 'warmpawz',
    tracking_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT delivery_tracking_order_check CHECK (
        (pharmacy_order_id IS NOT NULL AND meal_order_id IS NULL) OR
        (pharmacy_order_id IS NULL AND meal_order_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_pharmacy ON delivery_tracking(pharmacy_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_meal ON delivery_tracking(meal_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_partner ON delivery_tracking(logistics_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_active ON delivery_tracking(status) WHERE status NOT IN ('delivered', 'failed');
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_external_task_id ON delivery_tracking(external_task_id) WHERE external_task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS delivery_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES delivery_tracking(id) ON DELETE CASCADE,
    lat NUMERIC(10,7) NOT NULL,
    lng NUMERIC(10,7) NOT NULL,
    accuracy_meters NUMERIC(6,2),
    speed_kmh NUMERIC(5,2),
    heading INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_tracking ON delivery_location_history(tracking_id, recorded_at DESC);

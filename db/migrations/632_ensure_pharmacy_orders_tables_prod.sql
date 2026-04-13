-- ============================================================================
-- MIGRATION 632: Ensure pharmacy_orders + pharmacy_broadcasts exist (prod parity with dev)
-- ============================================================================
-- Date: 2026-03-31
-- Problem: Prod RDS never ran migration 200; /pharmacy/orders/create fails with
--   relation "pharmacy_orders" does not exist
-- This file copies the pharmacy slice from 200_pharmacy_meal_delivery_complete.sql
-- (CREATE IF NOT EXISTS + order number trigger). Safe to re-run.
-- After this, run 305, 411, 508, 509, 608 in order (see run-all-pending-migrations-prod.js).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pharmacy_orders (same as migration 200 PART 2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    prescription_id UUID REFERENCES prescriptions(id),
    pharmacy_id UUID REFERENCES vendors(id),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) DEFAULT 0,
    platform_fee NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    delivery_address JSONB NOT NULL,
    customer_lat NUMERIC(10,7),
    customer_lng NUMERIC(10,7),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('online', 'cod')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    logistics_type VARCHAR(20) DEFAULT 'warmpawz',
    logistics_partner_id UUID REFERENCES vendors(id),
    logistics_cost NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'broadcasting', 'accepted', 'preparing',
        'ready_for_pickup', 'picked_up', 'on_the_way',
        'delivered', 'cancelled', 'rejected'
    )),
    current_broadcast_radius_km INTEGER DEFAULT 5,
    broadcast_started_at TIMESTAMPTZ,
    broadcast_expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    prepared_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'completed')),
    vendor_payout NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    logistics_deduction NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_customer ON pharmacy_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy ON pharmacy_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_broadcasting ON pharmacy_orders(status, broadcast_expires_at)
    WHERE status = 'broadcasting';

-- ----------------------------------------------------------------------------
-- pharmacy_broadcasts (same as migration 200)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pharmacy_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    pharmacy_id UUID NOT NULL REFERENCES vendors(id),
    radius_km INTEGER NOT NULL,
    distance_from_customer NUMERIC(5,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected', 'expired')),
    broadcast_time TIMESTAMPTZ DEFAULT NOW(),
    response_time TIMESTAMPTZ,
    rejection_reason TEXT,
    quoted_delivery_fee NUMERIC(10,2),
    quoted_eta_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, pharmacy_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_pending ON pharmacy_broadcasts(pharmacy_id, status)
    WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- Auto order_number PH* (inserts omit order_number)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := prefix || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pharmacy_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number('PH');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pharmacy_order_number ON pharmacy_orders;
CREATE TRIGGER trigger_pharmacy_order_number
    BEFORE INSERT ON pharmacy_orders
    FOR EACH ROW
    EXECUTE PROCEDURE set_pharmacy_order_number();

-- ----------------------------------------------------------------------------
-- logistics_type: match dev / 1002 (Pidge, Dunzo) — pharmacy_orders only
-- ----------------------------------------------------------------------------
ALTER TABLE pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_logistics_type_check;
ALTER TABLE pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_logistics_type_check
  CHECK (logistics_type IN ('own', 'warmpawz', 'dunzo', 'pidge'));

DO $$
BEGIN
    RAISE NOTICE '632: pharmacy_orders and pharmacy_broadcasts ensured; PH order trigger + logistics check applied';
END $$;

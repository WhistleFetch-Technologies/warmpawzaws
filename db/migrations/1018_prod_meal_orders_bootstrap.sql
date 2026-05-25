-- ============================================================================
-- 1018: Bootstrap meal_orders on prod when migration 200 never created the table.
-- Safe to re-run (IF NOT EXISTS). Run 1010 after this succeeds.
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id),
    subscription_id UUID REFERENCES meal_subscriptions(id),
    pet_id UUID REFERENCES pets(id),
    order_type VARCHAR(20) DEFAULT 'adhoc',
    quantity INTEGER DEFAULT 1,
    special_instructions TEXT,
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) DEFAULT 0,
    platform_fee NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    delivery_address JSONB NOT NULL,
    customer_lat NUMERIC(10,7),
    customer_lng NUMERIC(10,7),
    scheduled_delivery_date DATE NOT NULL,
    scheduled_delivery_slot JSONB,
    payment_status VARCHAR(20) DEFAULT 'pending',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    logistics_type VARCHAR(20) DEFAULT 'warmpawz',
    logistics_partner_id UUID REFERENCES vendors(id),
    logistics_cost NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    prep_started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    settlement_status VARCHAR(20) DEFAULT 'pending',
    vendor_payout NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    logistics_deduction NUMERIC(10,2),
    rating INTEGER,
    review TEXT,
    rated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extensions from 744 / 752 / 1010 / 1011 (idempotent)
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS purchase_type TEXT;
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS purchase_snapshot JSONB;
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS prep_minutes INTEGER;
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS expected_ready_at TIMESTAMPTZ;
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS pidge_order_id VARCHAR(255);
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS pre_pause_order_status VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_meal_orders_customer ON meal_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_vendor ON meal_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_subscription ON meal_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_status ON meal_orders(status);
CREATE INDEX IF NOT EXISTS idx_meal_orders_delivery_date ON meal_orders(scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_meal_orders_pidge_order_id ON meal_orders(pidge_order_id) WHERE pidge_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_orders_expected_ready_at ON meal_orders(expected_ready_at) WHERE expected_ready_at IS NOT NULL;

-- 1002: allow pidge/dunzo logistics types when constraint exists
ALTER TABLE meal_orders DROP CONSTRAINT IF EXISTS meal_orders_logistics_type_check;
ALTER TABLE meal_orders ADD CONSTRAINT meal_orders_logistics_type_check
  CHECK (logistics_type IN ('own', 'warmpawz', 'pidge', 'dunzo'));

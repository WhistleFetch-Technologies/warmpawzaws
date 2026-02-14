-- Prod-only: create package_purchases and link package_sessions (prod has package_sessions without package_purchase_id).
-- Run once on prod, then run 553.

CREATE TABLE IF NOT EXISTS package_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id TEXT NOT NULL UNIQUE,
    package_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    package_type TEXT NOT NULL CHECK (package_type IN ('bundle', 'time_based', 'appointment', 'membership', 'subscription')),
    package_price NUMERIC(10, 2) NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    total_sessions INTEGER DEFAULT 0,
    remaining_sessions INTEGER DEFAULT 0,
    unlimited_usage BOOLEAN DEFAULT false,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    payment_id UUID,
    payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'used_up')),
    is_recurring BOOLEAN DEFAULT false,
    next_billing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_purchases_customer ON package_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_package ON package_purchases(package_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_vendor ON package_purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_status ON package_purchases(status);
CREATE INDEX IF NOT EXISTS idx_package_purchases_purchase_id ON package_purchases(purchase_id);

ALTER TABLE package_sessions ADD COLUMN IF NOT EXISTS package_purchase_id UUID REFERENCES package_purchases(id) ON DELETE CASCADE;

ALTER TABLE package_sessions DROP CONSTRAINT IF EXISTS fk_package_sessions_purchase;
ALTER TABLE package_sessions ADD CONSTRAINT fk_package_sessions_purchase FOREIGN KEY (package_purchase_id) REFERENCES package_purchases(id) ON DELETE CASCADE;

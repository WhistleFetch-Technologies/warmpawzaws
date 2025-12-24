-- ============================================================================
-- MIGRATION 013: Package Purchases Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create package_purchases table to support package purchase tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id TEXT NOT NULL UNIQUE, -- Human-readable purchase ID
    package_id UUID NOT NULL, -- References service_packages or package_id
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Package snapshot at purchase time
    package_name TEXT NOT NULL,
    package_type TEXT NOT NULL CHECK (package_type IN ('bundle', 'time_based', 'appointment', 'membership', 'subscription')),
    package_price NUMERIC(10, 2) NOT NULL,
    
    -- Validity
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Usage
    total_sessions INTEGER DEFAULT 0,
    remaining_sessions INTEGER DEFAULT 0,
    unlimited_usage BOOLEAN DEFAULT false,
    
    -- Payment
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    payment_id UUID,
    payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'used_up')),
    
    -- Subscription (if applicable)
    is_recurring BOOLEAN DEFAULT false,
    next_billing_date TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_package_purchases_customer ON package_purchases(customer_id);
CREATE INDEX idx_package_purchases_package ON package_purchases(package_id);
CREATE INDEX idx_package_purchases_vendor ON package_purchases(vendor_id);
CREATE INDEX idx_package_purchases_status ON package_purchases(status);
CREATE INDEX idx_package_purchases_purchase_id ON package_purchases(purchase_id);

-- Add foreign key constraint for package_sessions
ALTER TABLE package_sessions 
    ADD CONSTRAINT fk_package_sessions_purchase 
    FOREIGN KEY (package_purchase_id) 
    REFERENCES package_purchases(id) 
    ON DELETE CASCADE;

COMMENT ON TABLE package_purchases IS 'Stores package purchases/enrollments, replacing KV store usage';
COMMENT ON COLUMN package_purchases.purchase_id IS 'Human-readable purchase ID (e.g., pur_1234567890_abc123)';
COMMENT ON COLUMN package_purchases.package_id IS 'References service_packages.id or package_id from service_packages table';


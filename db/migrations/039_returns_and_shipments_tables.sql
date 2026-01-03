-- ============================================================================
-- RETURNS AND SHIPMENTS TABLES
-- ============================================================================
-- Tables for returns management and logistics tracking
-- ============================================================================

-- Returns
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    items JSONB NOT NULL, -- Array of items being returned
    return_reason TEXT NOT NULL CHECK (return_reason IN ('defective', 'change_of_mind', 'wrong_item', 'damaged', 'other')),
    description TEXT,
    images TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'picked_up', 'received', 'refunded', 'cancelled')),
    pickup_address JSONB DEFAULT '{}'::jsonb,
    logistics JSONB, -- { partner, awb, trackingUrl }
    refund JSONB, -- { amount, method, status, transactionId }
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_vendor_id ON returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    logistics_partner TEXT NOT NULL, -- 'shiprocket', 'delhivery', etc.
    shipment_id TEXT,
    awb_code TEXT,
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'awb_generated', 'picked_up', 'in_transit', 'delivered', 'returned', 'cancelled')),
    tracking_url TEXT,
    pickup_address JSONB,
    delivery_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_shipment_id ON shipments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_awb_code ON shipments(awb_code);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_returns_updated_at
    BEFORE UPDATE ON returns
    FOR EACH ROW
    EXECUTE FUNCTION update_returns_updated_at();

CREATE TRIGGER trigger_update_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_returns_updated_at();


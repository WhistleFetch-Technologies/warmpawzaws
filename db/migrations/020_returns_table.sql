-- ============================================================================
-- RETURNS TABLE
-- ============================================================================
-- Table for managing e-commerce order returns
-- Replaces: return:{returnId} KV keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Return details
    reason TEXT NOT NULL,
    reason_category TEXT CHECK (reason_category IN ('damaged', 'wrong_item', 'not_as_described', 'defective', 'other')),
    description TEXT,
    request_type TEXT DEFAULT 'return' CHECK (request_type IN ('return', 'exchange')),
    exchange_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Items to return
    item_ids TEXT[] DEFAULT '{}',
    quantity INTEGER DEFAULT 1,
    amount NUMERIC(10, 2) NOT NULL,
    
    -- Evidence
    images TEXT[] DEFAULT '{}',
    photos TEXT[] DEFAULT '{}',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'picked_up', 'refunded', 'exchanged'
    )),
    
    -- Return method
    return_method TEXT DEFAULT 'pickup' CHECK (return_method IN ('pickup', 'drop')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Refund details
    refund_amount NUMERIC(10, 2),
    refund_method TEXT,
    rejection_reason TEXT,
    admin_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_customer_id ON return_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_vendor_id ON return_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_return_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_return_requests_updated_at
    BEFORE UPDATE ON return_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_return_requests_updated_at();


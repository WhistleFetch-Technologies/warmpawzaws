-- ============================================================================
-- MIGRATION 211: Returns & Refunds Management
-- ============================================================================
-- Purpose: Complete return management system with refund processing
-- Date: 2026-01-20
-- ============================================================================

-- ============================================================================
-- RETURN REQUESTS TABLE - Already exists, just add missing columns
-- ============================================================================

DO $$ BEGIN
    -- Add missing columns to return_requests
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'return_number') THEN
        ALTER TABLE return_requests ADD COLUMN return_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'total_refund_amount') THEN
        ALTER TABLE return_requests ADD COLUMN total_refund_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'refund_transaction_id') THEN
        ALTER TABLE return_requests ADD COLUMN refund_transaction_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'pickup_address') THEN
        ALTER TABLE return_requests ADD COLUMN pickup_address JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'preferred_pickup_date') THEN
        ALTER TABLE return_requests ADD COLUMN preferred_pickup_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'pickup_date') THEN
        ALTER TABLE return_requests ADD COLUMN pickup_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'pickup_slot') THEN
        ALTER TABLE return_requests ADD COLUMN pickup_slot TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'courier_partner') THEN
        ALTER TABLE return_requests ADD COLUMN courier_partner TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'pickup_awb') THEN
        ALTER TABLE return_requests ADD COLUMN pickup_awb TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'bank_account_details') THEN
        ALTER TABLE return_requests ADD COLUMN bank_account_details JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'quality_check_result') THEN
        ALTER TABLE return_requests ADD COLUMN quality_check_result TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'vendor_notes') THEN
        ALTER TABLE return_requests ADD COLUMN vendor_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE return_requests ADD COLUMN cancellation_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'pickup_scheduled_at') THEN
        ALTER TABLE return_requests ADD COLUMN pickup_scheduled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'picked_up_at') THEN
        ALTER TABLE return_requests ADD COLUMN picked_up_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'received_at') THEN
        ALTER TABLE return_requests ADD COLUMN received_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'quality_checked_at') THEN
        ALTER TABLE return_requests ADD COLUMN quality_checked_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'refund_initiated_at') THEN
        ALTER TABLE return_requests ADD COLUMN refund_initiated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'refund_completed_at') THEN
        ALTER TABLE return_requests ADD COLUMN refund_completed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_requests' AND column_name = 'cancelled_at') THEN
        ALTER TABLE return_requests ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create unique index on return_number if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'return_requests_return_number_key') THEN
        CREATE UNIQUE INDEX return_requests_return_number_key ON return_requests(return_number) WHERE return_number IS NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_customer ON return_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_vendor ON return_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_number ON return_requests(return_number);
CREATE INDEX IF NOT EXISTS idx_return_requests_vendor_status ON return_requests(vendor_id, status);

COMMENT ON TABLE return_requests IS 'Return requests from customers with full lifecycle tracking';

-- ============================================================================
-- RETURN ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Item details
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    comments TEXT,
    
    -- Refund
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    -- Status (can be different from parent request)
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'received', 'quality_pass', 'quality_fail', 'refunded'
    )),
    
    -- Quality check
    quality_check_notes TEXT,
    quality_check_photos JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_items_request ON return_items(return_request_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);

COMMENT ON TABLE return_items IS 'Individual items in a return request';

-- ============================================================================
-- ORDER TABLE ENHANCEMENTS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'has_return_request') THEN
        ALTER TABLE orders ADD COLUMN has_return_request BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'return_status') THEN
        ALTER TABLE orders ADD COLUMN return_status TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'refund_amount') THEN
        ALTER TABLE orders ADD COLUMN refund_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- ORDER ITEMS ENHANCEMENTS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'returned_quantity') THEN
        ALTER TABLE order_items ADD COLUMN returned_quantity INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- VENDOR RETURN POLICY
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'is_returnable') THEN
        ALTER TABLE vendors ADD COLUMN is_returnable BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'return_window_days') THEN
        ALTER TABLE vendors ADD COLUMN return_window_days INTEGER DEFAULT 7;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'return_policy') THEN
        ALTER TABLE vendors ADD COLUMN return_policy TEXT;
    END IF;
END $$;

-- ============================================================================
-- PRODUCT RETURNABILITY
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_returnable') THEN
        ALTER TABLE products ADD COLUMN is_returnable BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'return_window_days') THEN
        ALTER TABLE products ADD COLUMN return_window_days INTEGER;
    END IF;
END $$;

-- ============================================================================
-- WALLET TRANSACTIONS (for refund crediting)
-- ============================================================================

-- Wallet transactions table - already exists with wallet_id instead of customer_id
-- Just ensure indexes exist (table already has proper columns)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);

COMMENT ON TABLE wallet_transactions IS 'Customer wallet transaction history for refunds and credits';

-- ============================================================================
-- SUMMARY
-- ============================================================================

COMMENT ON TABLE return_requests IS 'Return requests with complete lifecycle from request to refund';
COMMENT ON TABLE return_items IS 'Individual items in return requests with quality check tracking';
COMMENT ON TABLE wallet_transactions IS 'Wallet transactions including refund credits';

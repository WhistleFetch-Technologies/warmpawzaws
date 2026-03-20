-- ============================================================================
-- MIGRATION 075: Pharmacy Order Broadcasts Table
-- ============================================================================
-- Date: 2025-01-30
-- Purpose: Create pharmacy_order_broadcasts table for Phase 1.4 (Uber-style pharmacy orders)
-- Phase: 1.4 - Pharmacy Service
-- ============================================================================

-- Create pharmacy_order_broadcasts table
CREATE TABLE IF NOT EXISTS pharmacy_order_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pharmacy_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_rejected', 'expired')),
    broadcast_time TIMESTAMPTZ DEFAULT NOW(),
    response_time TIMESTAMPTZ,
    rejection_reason TEXT,
    distance_km NUMERIC(5, 2),
    delivery_fee NUMERIC(10, 2),
    eta_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(order_id, pharmacy_id)
);

COMMENT ON TABLE pharmacy_order_broadcasts IS 'Tracks pharmacy order broadcasts (Uber-style) for prescription orders. Stores broadcast status, distance, delivery fee, and ETA for each pharmacy.';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_order_id ON pharmacy_order_broadcasts(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_pharmacy_id ON pharmacy_order_broadcasts(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_status ON pharmacy_order_broadcasts(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_order_pharmacy ON pharmacy_order_broadcasts(order_id, pharmacy_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_pharmacy_broadcasts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pharmacy_broadcasts_updated_at
    BEFORE UPDATE ON pharmacy_order_broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_broadcasts_updated_at();

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'pharmacy_order_broadcasts'
    ) THEN
        RAISE EXCEPTION 'pharmacy_order_broadcasts table not created';
    END IF;
END $$;

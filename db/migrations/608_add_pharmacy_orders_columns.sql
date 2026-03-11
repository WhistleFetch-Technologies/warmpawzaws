-- ============================================================================
-- MIGRATION 608: Add pharmacy_orders columns (from inline code changes)
-- Date: 2026-02-28
-- Purpose: Migrate inline ALTER TABLE statements from pharmacy-orders.ts to proper migration
-- ============================================================================
-- This migration adds all columns that were being added inline in the code
-- Source: backend/lambda/src/endpoints/pharmacy-orders.ts (lines 2283-2298, 158-160)
-- ============================================================================

-- Add columns to pharmacy_orders table
DO $$
BEGIN
  -- Financial columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'subtotal') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.subtotal IS 'Order subtotal before fees and taxes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'delivery_fee') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.delivery_fee IS 'Delivery fee for the order';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'platform_fee') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN platform_fee DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.platform_fee IS 'Platform commission fee';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'convenience_fee') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN convenience_fee DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.convenience_fee IS 'Convenience fee for the order';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'tax_amount') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.tax_amount IS 'Total tax amount';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'tax_breakdown') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN tax_breakdown JSONB;
    COMMENT ON COLUMN pharmacy_orders.tax_breakdown IS 'Detailed tax breakdown (GST, etc.)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'total_amount') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN pharmacy_orders.total_amount IS 'Total order amount including all fees and taxes';
  END IF;

  -- Location columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'delivery_lat') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN delivery_lat DECIMAL(10,6);
    COMMENT ON COLUMN pharmacy_orders.delivery_lat IS 'Delivery address latitude';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'delivery_lng') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN delivery_lng DECIMAL(10,6);
    COMMENT ON COLUMN pharmacy_orders.delivery_lng IS 'Delivery address longitude';
  END IF;

  -- Prescription and broadcast columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'prescription_verified') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN prescription_verified BOOLEAN DEFAULT false;
    COMMENT ON COLUMN pharmacy_orders.prescription_verified IS 'Whether prescription has been verified';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'current_broadcast_radius') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN current_broadcast_radius INTEGER DEFAULT 5;
    COMMENT ON COLUMN pharmacy_orders.current_broadcast_radius IS 'Current broadcast radius in km';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'max_broadcast_radius') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN max_broadcast_radius INTEGER DEFAULT 20;
    COMMENT ON COLUMN pharmacy_orders.max_broadcast_radius IS 'Maximum broadcast radius in km';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'broadcast_started_at') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN broadcast_started_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN pharmacy_orders.broadcast_started_at IS 'When broadcast to pharmacies started';
  END IF;

  -- Customer phone (from line 158)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'customer_phone') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN customer_phone VARCHAR(20);
    COMMENT ON COLUMN pharmacy_orders.customer_phone IS 'Customer phone number (denormalized)';
  END IF;

  -- Prescription URL (from line 159)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_orders' AND column_name = 'prescription_url') THEN
    ALTER TABLE pharmacy_orders ADD COLUMN prescription_url TEXT;
    COMMENT ON COLUMN pharmacy_orders.prescription_url IS 'URL to prescription document';
  END IF;
END $$;

-- Add updated_at to pharmacy_broadcasts (from line 160)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pharmacy_broadcasts' AND column_name = 'updated_at') THEN
    ALTER TABLE pharmacy_broadcasts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN pharmacy_broadcasts.updated_at IS 'Timestamp when broadcast was last updated';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_delivery_coords ON pharmacy_orders(delivery_lat, delivery_lng) WHERE delivery_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_customer_phone ON pharmacy_orders(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_broadcast_started ON pharmacy_orders(broadcast_started_at) WHERE broadcast_started_at IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

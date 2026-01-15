-- ============================================================================
-- PHARMACY ORDER BROADCASTS TABLE
-- ============================================================================
-- Stores broadcast records for Uber-like pharmacy order dispatch
-- Date: 2026-01-15
-- ============================================================================

-- Create pharmacy_order_broadcasts table
CREATE TABLE IF NOT EXISTS pharmacy_order_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, expired, auto_rejected
  broadcast_time TIMESTAMP DEFAULT NOW(),
  response_time TIMESTAMP,
  rejection_reason TEXT,
  distance_km DECIMAL(5,2),
  delivery_fee DECIMAL(10,2),
  eta_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_order_id ON pharmacy_order_broadcasts(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_pharmacy_id ON pharmacy_order_broadcasts(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_status ON pharmacy_order_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_broadcast_time ON pharmacy_order_broadcasts(broadcast_time);

-- Add new columns to orders table for pharmacy flow
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescription_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pharmacy_response_deadline TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_data JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_eta TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6);

-- Add new order statuses for pharmacy flow
-- broadcast: Order broadcast to pharmacies, waiting for acceptance
-- confirmed: Pharmacy accepted, preparing invoice
-- invoice_generated: Invoice sent to customer
-- payment_confirmed: Customer paid or selected COD
-- preparing: Pharmacy preparing order
-- dispatched: Out for delivery
-- delivered: Order completed

COMMENT ON TABLE pharmacy_order_broadcasts IS 'Uber-like order broadcast to nearby pharmacies';
COMMENT ON COLUMN pharmacy_order_broadcasts.status IS 'pending, accepted, rejected, expired, auto_rejected';
COMMENT ON COLUMN pharmacy_order_broadcasts.distance_km IS 'Distance from pharmacy to customer';
COMMENT ON COLUMN pharmacy_order_broadcasts.delivery_fee IS 'Calculated delivery fee based on distance';
COMMENT ON COLUMN pharmacy_order_broadcasts.eta_minutes IS 'Estimated delivery time in minutes';

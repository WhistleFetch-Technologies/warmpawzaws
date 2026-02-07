-- ============================================================================
-- MIGRATION 305: Add Pharmacy Tracking Fields
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add broadcast_radius, broadcast_expanded_at, perfora_invoice_url, 
--          logistics_partner_id, tracking_status to pharmacy_orders table
-- Phase: Phase 4 - Pharmacy & Delivery Flow
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- ============================================================================

-- Add broadcast_radius column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'broadcast_radius'
    ) THEN
        ALTER TABLE pharmacy_orders ADD COLUMN broadcast_radius INTEGER DEFAULT 5;
        COMMENT ON COLUMN pharmacy_orders.broadcast_radius IS 'Current broadcast radius in km (5, 10, or 20)';
    END IF;
END $$;

-- Add broadcast_expanded_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'broadcast_expanded_at'
    ) THEN
        ALTER TABLE pharmacy_orders ADD COLUMN broadcast_expanded_at TIMESTAMPTZ;
        COMMENT ON COLUMN pharmacy_orders.broadcast_expanded_at IS 'Timestamp when broadcast radius was last expanded';
    END IF;
END $$;

-- Add perfora_invoice_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'perfora_invoice_url'
    ) THEN
        ALTER TABLE pharmacy_orders ADD COLUMN perfora_invoice_url TEXT;
        COMMENT ON COLUMN pharmacy_orders.perfora_invoice_url IS 'S3 URL of uploaded perfora invoice';
    END IF;
END $$;

-- Add logistics_partner_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'logistics_partner_id'
    ) THEN
        ALTER TABLE pharmacy_orders ADD COLUMN logistics_partner_id UUID;
        COMMENT ON COLUMN pharmacy_orders.logistics_partner_id IS 'Assigned logistics partner ID';
    END IF;
END $$;

-- Add tracking_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pharmacy_orders' AND column_name = 'tracking_status'
    ) THEN
        ALTER TABLE pharmacy_orders ADD COLUMN tracking_status VARCHAR(50);
        COMMENT ON COLUMN pharmacy_orders.tracking_status IS 'Current tracking status (assigned, heading_to_pickup, at_pickup, picked_up, on_the_way, delivered)';
    END IF;
END $$;

-- Create logistics_partners table if it doesn't exist
CREATE TABLE IF NOT EXISTS logistics_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id VARCHAR(100) UNIQUE NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(50) NOT NULL, -- 'warmpawz', 'shiprocket', 'dunzo', 'vendor_own', etc.
    api_key TEXT,
    api_secret TEXT,
    is_active BOOLEAN DEFAULT true,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE logistics_partners IS 'Logistics partners for order delivery';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_broadcast_radius ON pharmacy_orders(broadcast_radius) WHERE broadcast_radius IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_logistics_partner_id ON pharmacy_orders(logistics_partner_id) WHERE logistics_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logistics_partners_partner_id ON logistics_partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_logistics_partners_partner_type ON logistics_partners(partner_type);

COMMENT ON TABLE pharmacy_orders IS 'Pharmacy orders with broadcast and tracking fields';

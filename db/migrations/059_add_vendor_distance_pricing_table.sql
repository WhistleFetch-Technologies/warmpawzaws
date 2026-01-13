-- ============================================================================
-- Migration 059: Add Vendor Distance Pricing Table
-- Date: 2026-01-12
-- Purpose: Create vendor_distance_pricing table for distance-based pricing rules
-- ============================================================================

BEGIN;

-- Create vendor_distance_pricing table
CREATE TABLE IF NOT EXISTS vendor_distance_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  base_dist DECIMAL(10,2) NOT NULL CHECK (base_dist >= 0),
  price_per_km DECIMAL(10,2) NOT NULL CHECK (price_per_km >= 0),
  max_distance DECIMAL(10,2) CHECK (max_distance IS NULL OR max_distance > 0),
  min_charge DECIMAL(10,2) CHECK (min_charge IS NULL OR min_charge >= 0),
  surge_multiplier DECIMAL(3,2) DEFAULT 1.0 CHECK (surge_multiplier > 0),
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.0 CHECK (peak_hour_multiplier > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT unique_vendor_service UNIQUE (vendor_id, service_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_distance_pricing_vendor_id ON vendor_distance_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_distance_pricing_active ON vendor_distance_pricing(vendor_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendor_distance_pricing_service ON vendor_distance_pricing(service_name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendor_distance_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_distance_pricing_updated_at ON vendor_distance_pricing;
CREATE TRIGGER trigger_update_vendor_distance_pricing_updated_at
  BEFORE UPDATE ON vendor_distance_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_distance_pricing_updated_at();

-- Comments for documentation
COMMENT ON TABLE vendor_distance_pricing IS 'Stores distance-based pricing rules for vendor services';
COMMENT ON COLUMN vendor_distance_pricing.base_price IS 'Base price for the service (in INR)';
COMMENT ON COLUMN vendor_distance_pricing.base_dist IS 'Base distance included in base_price (in km)';
COMMENT ON COLUMN vendor_distance_pricing.price_per_km IS 'Additional price per kilometer beyond base distance (in INR)';
COMMENT ON COLUMN vendor_distance_pricing.max_distance IS 'Maximum distance for this service (NULL = no limit)';
COMMENT ON COLUMN vendor_distance_pricing.min_charge IS 'Minimum charge for this service (NULL = no minimum)';
COMMENT ON COLUMN vendor_distance_pricing.surge_multiplier IS 'Multiplier for surge pricing (default 1.0)';
COMMENT ON COLUMN vendor_distance_pricing.peak_hour_multiplier IS 'Multiplier for peak hour pricing (default 1.0)';

COMMIT;

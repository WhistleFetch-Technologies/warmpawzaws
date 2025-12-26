-- ============================================================================
-- MIGRATION 035: Service Publishing Centre Level Support
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add centre_id column to vendor_services for centre-level publishing
-- ============================================================================

-- Add centre_id column to vendor_services if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' 
    AND column_name = 'centre_id'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN centre_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    ADD COLUMN publish_level TEXT DEFAULT 'vendor' CHECK (publish_level IN ('vendor', 'centre')),
    ADD COLUMN price_override NUMERIC(10, 2),
    ADD COLUMN custom_package_enabled BOOLEAN DEFAULT false,
    ADD COLUMN gps_required BOOLEAN DEFAULT false,
    ADD COLUMN gps_tracking JSONB;
    
    -- Update unique constraint to include centre_id
    ALTER TABLE vendor_services 
    DROP CONSTRAINT IF EXISTS vendor_services_vendor_id_service_id_service_style_key;
    
    CREATE UNIQUE INDEX IF NOT EXISTS vendor_services_unique_vendor 
      ON vendor_services(vendor_id, service_id, service_style) 
      WHERE centre_id IS NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS vendor_services_unique_centre 
      ON vendor_services(vendor_id, service_id, service_style, centre_id) 
      WHERE centre_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_services_centre_id ON vendor_services(centre_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_publish_level ON vendor_services(publish_level);

COMMENT ON COLUMN vendor_services.centre_id IS 'Centre ID for centre-level publishing (NULL for vendor-level)';
COMMENT ON COLUMN vendor_services.publish_level IS 'Publishing level: vendor or centre';
COMMENT ON COLUMN vendor_services.price_override IS 'Price override for centre-level publishing';
COMMENT ON COLUMN vendor_services.custom_package_enabled IS 'Whether custom packages are enabled (centre-level only)';


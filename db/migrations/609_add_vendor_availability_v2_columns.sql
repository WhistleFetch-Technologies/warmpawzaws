-- ============================================================================
-- MIGRATION 609: Add vendor_availability_v2 columns (from inline code changes)
-- Date: 2026-02-28
-- Purpose: Migrate inline ALTER TABLE statements from vendor-schedule.ts to proper migration
-- ============================================================================
-- This migration adds columns that were being added inline in the code
-- Source: backend/lambda/src/endpoints/vendor-schedule.ts (lines 1506-1509)
-- ============================================================================

DO $$
BEGIN
  -- Add service_styles column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'service_styles') THEN
    ALTER TABLE vendor_availability_v2 ADD COLUMN service_styles TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN vendor_availability_v2.service_styles IS 'Array of service styles this availability applies to';
  END IF;

  -- Add location_data column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'location_data') THEN
    ALTER TABLE vendor_availability_v2 ADD COLUMN location_data JSONB;
    COMMENT ON COLUMN vendor_availability_v2.location_data IS 'Location-specific data (coordinates, address, etc.)';
  END IF;

  -- Add buffer_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'buffer_time') THEN
    ALTER TABLE vendor_availability_v2 ADD COLUMN buffer_time INTEGER DEFAULT 15;
    COMMENT ON COLUMN vendor_availability_v2.buffer_time IS 'Buffer time in minutes between appointments';
  END IF;

  -- Add lead_time_by_style column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'lead_time_by_style') THEN
    ALTER TABLE vendor_availability_v2 ADD COLUMN lead_time_by_style JSONB;
    COMMENT ON COLUMN vendor_availability_v2.lead_time_by_style IS 'Lead time requirements by service style';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_service_styles ON vendor_availability_v2 USING gin(service_styles);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_location_data ON vendor_availability_v2 USING gin(location_data) WHERE location_data IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

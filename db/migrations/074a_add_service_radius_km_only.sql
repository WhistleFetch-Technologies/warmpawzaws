-- Migration: Add service_radius_km and queue_config to vendor_services
-- Purpose: Quick fix for missing columns causing 500 error
-- Date: 2026-01-19

BEGIN;

-- Add service_radius_km column if it doesn't exist
ALTER TABLE vendor_services 
ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(5, 2) DEFAULT NULL;

COMMENT ON COLUMN vendor_services.service_radius_km IS 'Service coverage radius in kilometers for at_home services. NULL means unlimited or uses vendor default.';

-- Add queue_config column if it doesn't exist
ALTER TABLE vendor_services 
ADD COLUMN IF NOT EXISTS queue_config JSONB DEFAULT NULL;

COMMENT ON COLUMN vendor_services.queue_config IS 'Queue configuration for tele services: max_queue_size, avg_wait_time_minutes, auto_accept, priority_rules';

-- Verify columns added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_services' AND column_name = 'service_radius_km'
    ) THEN
        RAISE EXCEPTION 'service_radius_km column not added';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendor_services' AND column_name = 'queue_config'
    ) THEN
        RAISE EXCEPTION 'queue_config column not added';
    END IF;
    
    RAISE NOTICE '✅ service_radius_km and queue_config columns added successfully';
END $$;

COMMIT;

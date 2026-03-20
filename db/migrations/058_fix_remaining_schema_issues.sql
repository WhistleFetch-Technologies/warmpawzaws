-- ============================================================================
-- Migration 058: Fix Remaining Schema Issues
-- Date: 2026-01-12
-- Purpose: Add missing columns and create missing tables for remaining 30 failing endpoints
-- ============================================================================
-- This migration addresses:
-- 1. Missing columns in existing tables
-- 2. Missing tables (vendor_services, vendor_settings, subscription_plans)
-- 3. Column name mismatches (time_window_start vs start_time)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add rating column to vendors table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'rating'
  ) THEN
    ALTER TABLE vendors ADD COLUMN rating NUMERIC(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);
    COMMENT ON COLUMN vendors.rating IS 'Vendor rating (0-5 stars)';
  END IF;
END $$;

-- Add net_amount column to payments table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN net_amount DECIMAL(10, 2);
    COMMENT ON COLUMN payments.net_amount IS 'Net amount after commission and discounts';
  END IF;
END $$;

-- Add is_approved column to reviews table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_approved BOOLEAN DEFAULT false;
    ALTER TABLE reviews ADD COLUMN approved_at TIMESTAMP;
    ALTER TABLE reviews ADD COLUMN rejection_reason TEXT;
    COMMENT ON COLUMN reviews.is_approved IS 'Whether review is approved by admin';
    COMMENT ON COLUMN reviews.approved_at IS 'When review was approved';
    COMMENT ON COLUMN reviews.rejection_reason IS 'Reason for rejection if not approved';
  END IF;
END $$;

-- Add available_time_start and available_time_end to staff_availability table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_availability' AND column_name = 'available_time_start'
  ) THEN
    ALTER TABLE staff_availability ADD COLUMN available_time_start TIME;
    COMMENT ON COLUMN staff_availability.available_time_start IS 'Start time for availability slot';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_availability' AND column_name = 'available_time_end'
  ) THEN
    ALTER TABLE staff_availability ADD COLUMN available_time_end TIME;
    COMMENT ON COLUMN staff_availability.available_time_end IS 'End time for availability slot';
  END IF;
END $$;

-- ============================================================================
-- 2. FIX COLUMN NAME MISMATCH IN vendor_availability_v2
-- ============================================================================
-- The table has start_time/end_time but code expects time_window_start/time_window_end
-- Add aliases or update queries. For now, add the expected columns if they don't exist.

DO $$
BEGIN
  -- Check if time_window_start exists, if not, add it as alias to start_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2' AND column_name = 'time_window_start'
  ) THEN
    -- Add the columns that the code expects
    ALTER TABLE vendor_availability_v2 
    ADD COLUMN time_window_start TIME,
    ADD COLUMN time_window_end TIME;
    
    -- Copy data from start_time/end_time to time_window_start/time_window_end
    UPDATE vendor_availability_v2 
    SET time_window_start = start_time,
        time_window_end = end_time
    WHERE time_window_start IS NULL;
    
    COMMENT ON COLUMN vendor_availability_v2.time_window_start IS 'Start time window (alias for start_time)';
    COMMENT ON COLUMN vendor_availability_v2.time_window_end IS 'End time window (alias for end_time)';
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE MISSING TABLES
-- ============================================================================

-- Vendor Services table (check if exists in migration 007)
CREATE TABLE IF NOT EXISTS vendor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  service_id UUID, -- References service catalog
  service_name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele')),
  publish_status TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'auto_published')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_custom_service BOOLEAN DEFAULT false,
  custom_price DECIMAL(10, 2),
  custom_duration INTEGER,
  custom_description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_vendor_service_style UNIQUE (vendor_id, service_id, service_style)
);

COMMENT ON TABLE vendor_services IS 'Vendor published services - maps from vendor_services:{vendorId}:{style} KV keys';

-- Vendor Settings table
CREATE TABLE IF NOT EXISTS vendor_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  radar_distance_km NUMERIC(5, 2) DEFAULT 10,
  radar_enabled BOOLEAN DEFAULT true,
  service_style_radar_distances JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE vendor_settings IS 'Vendor-specific settings including radar distance configuration';

-- Subscription Plans table (check if exists in migrations 030, 035, 033)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly', 'weekly')),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscription_plans IS 'Vendor subscription plans for recurring services';

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

-- Vendor Services indexes
CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor_id ON vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_publish_status ON vendor_services(publish_status, is_enabled);
CREATE INDEX IF NOT EXISTS idx_vendor_services_service_style ON vendor_services(service_style);
CREATE INDEX IF NOT EXISTS idx_vendor_services_category ON vendor_services(category);

-- Vendor Settings indexes
CREATE INDEX IF NOT EXISTS idx_vendor_settings_vendor_id ON vendor_settings(vendor_id);

-- Subscription Plans indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_vendor_id ON subscription_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = true;

-- Reviews indexes (for is_approved)
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved) WHERE is_approved = false;

-- Vendors indexes (for rating)
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating) WHERE rating > 0;

-- ============================================================================
-- 5. UPDATE EXISTING DATA (if needed)
-- ============================================================================

-- Set default rating for existing vendors
UPDATE vendors SET rating = 0 WHERE rating IS NULL;

-- Set default is_approved for existing reviews
UPDATE reviews SET is_approved = false WHERE is_approved IS NULL;

-- Sync time_window columns with start_time/end_time in vendor_availability_v2
UPDATE vendor_availability_v2 
SET time_window_start = start_time,
    time_window_end = end_time
WHERE time_window_start IS NULL OR time_window_end IS NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- 
-- Verify columns added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'vendors' AND column_name = 'rating';
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'payments' AND column_name = 'net_amount';
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'reviews' AND column_name = 'is_approved';
--
-- Verify tables created:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('vendor_services', 'vendor_settings', 'subscription_plans')
-- ORDER BY table_name;
-- ============================================================================

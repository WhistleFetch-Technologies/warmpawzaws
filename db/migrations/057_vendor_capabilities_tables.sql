-- ============================================================================
-- Migration 057: Vendor Capabilities Tables
-- Date: 2026-01-12
-- Purpose: Create missing tables for vendor capability endpoints
-- ============================================================================
-- This migration creates tables needed for 38 failing vendor capability endpoints
-- All tables use IF NOT EXISTS for idempotency
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MEDICAL & HEALTH RECORDS
-- ============================================================================

-- Prescriptions table (if not exists in migration 034)
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  prescription_date DATE NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  instructions TEXT,
  doctor_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE prescriptions IS 'Prescriptions issued by vendors';
COMMENT ON COLUMN prescriptions.vendor_id IS 'Vendor who issued the prescription';
COMMENT ON COLUMN prescriptions.pet_id IS 'Pet for whom prescription is issued';

-- Medical records table (if not exists in migration 034)
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('vaccination', 'checkup', 'surgery', 'treatment', 'diagnostic', 'other')),
  record_date DATE NOT NULL,
  title VARCHAR(255),
  description TEXT,
  diagnosis TEXT,
  treatment TEXT,
  veterinarian_name VARCHAR(255),
  attachments JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE medical_records IS 'Medical records for pets';
COMMENT ON COLUMN medical_records.record_type IS 'Type of medical record: vaccination, checkup, surgery, treatment, diagnostic, other';

-- Diagnostic tests table
CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  test_name VARCHAR(255) NOT NULL,
  test_category VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2),
  duration_minutes INTEGER,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE diagnostic_tests IS 'Diagnostic tests available at vendor locations';

-- ============================================================================
-- 2. SERVICE & PACKAGE MANAGEMENT
-- ============================================================================

-- Service packages table (check if exists in other migrations)
CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER,
  sessions_included INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE service_packages IS 'Service packages offered by vendors (training, grooming, etc.)';
COMMENT ON COLUMN service_packages.service_type IS 'Type of service: training, grooming, boarding, etc.';

-- Package sessions table (check if exists in migration 032)
CREATE TABLE IF NOT EXISTS package_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_number INTEGER NOT NULL,
  session_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  progress_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_package_session UNIQUE (package_id, session_number)
);

COMMENT ON TABLE package_sessions IS 'Individual sessions within a service package';

-- ============================================================================
-- 3. TRACKING & LOCATION
-- ============================================================================

-- GPS tracking sessions table (check if exists in migrations 012, 031)
CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  route_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE gps_tracking_sessions IS 'GPS tracking sessions for bookings (walking, delivery, etc.)';

-- ============================================================================
-- 4. SCHEDULING & AVAILABILITY
-- ============================================================================

-- Vendor availability v2 table (check if exists in migration 006)
CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  service_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

COMMENT ON TABLE vendor_availability_v2 IS 'Vendor and staff availability schedules';
COMMENT ON COLUMN vendor_availability_v2.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';

-- ============================================================================
-- 5. FINANCIAL & SETTLEMENTS
-- ============================================================================

-- Vendor settlements table (check if exists in migration 020)
CREATE TABLE IF NOT EXISTS vendor_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  booking_ids UUID[] DEFAULT ARRAY[]::UUID[],
  payment_reference VARCHAR(255),
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_settlement_period CHECK (settlement_period_end >= settlement_period_start)
);

COMMENT ON TABLE vendor_settlements IS 'Vendor settlement and payout records';

-- ============================================================================
-- 6. SPECIALIZED SERVICES
-- ============================================================================

-- Ambulance vehicles table
CREATE TABLE IF NOT EXISTS ambulance_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('basic', 'advanced', 'critical')),
  driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  current_status VARCHAR(50) DEFAULT 'available' CHECK (current_status IN ('available', 'on_duty', 'maintenance', 'offline')),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  equipment JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_vehicle_number UNIQUE (vendor_id, vehicle_number)
);

COMMENT ON TABLE ambulance_vehicles IS 'Ambulance vehicles managed by vendors';

-- Meal plans table (check if exists in migration 033)
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  meals_per_day INTEGER DEFAULT 2 CHECK (meals_per_day >= 1 AND meals_per_day <= 5),
  dietary_requirements JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE meal_plans IS 'Nutrition meal plans offered by vendors';

-- Holiday packages table (check if exists in migration 018)
CREATE TABLE IF NOT EXISTS holiday_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  description TEXT,
  destination VARCHAR(255),
  duration_days INTEGER NOT NULL,
  price_per_pet DECIMAL(10, 2) NOT NULL,
  max_pets INTEGER,
  itinerary JSONB DEFAULT '[]'::jsonb,
  inclusions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE holiday_packages IS 'Holiday and tour packages for pets';

-- ============================================================================
-- 7. COMMUNICATION & REVIEWS
-- ============================================================================

-- Video call sessions table (check if exists in migration 032)
CREATE TABLE IF NOT EXISTS video_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  duration_minutes INTEGER,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled', 'failed')),
  meeting_url VARCHAR(500),
  recording_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE video_call_sessions IS 'Video call sessions for tele-consultations';

-- Reviews table (check if exists in initial schema)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  service_type VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE reviews IS 'Customer reviews and ratings for vendors';

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Prescriptions indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor ON prescriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer ON prescriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet ON prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_booking ON prescriptions(booking_id);

-- Medical records indexes
CREATE INDEX IF NOT EXISTS idx_medical_records_vendor ON medical_records(vendor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_pet ON medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(record_type);
CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records(record_date);

-- Diagnostic tests indexes
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_vendor ON diagnostic_tests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(test_category);

-- Service packages indexes
CREATE INDEX IF NOT EXISTS idx_service_packages_vendor ON service_packages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_service_packages_type ON service_packages(service_type);

-- Package sessions indexes
CREATE INDEX IF NOT EXISTS idx_package_sessions_package ON package_sessions(package_id);
CREATE INDEX IF NOT EXISTS idx_package_sessions_booking ON package_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_package_sessions_customer ON package_sessions(customer_id);

-- GPS tracking indexes
CREATE INDEX IF NOT EXISTS idx_gps_tracking_booking ON gps_tracking_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_vendor ON gps_tracking_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_status ON gps_tracking_sessions(status);

-- Vendor availability indexes
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_vendor ON vendor_availability_v2(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_staff ON vendor_availability_v2(staff_id);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_day ON vendor_availability_v2(day_of_week);

-- Vendor settlements indexes
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_vendor ON vendor_settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_status ON vendor_settlements(status);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_period ON vendor_settlements(settlement_period_start, settlement_period_end);

-- Ambulance vehicles indexes
CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_vendor ON ambulance_vehicles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_status ON ambulance_vehicles(current_status);

-- Meal plans indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_vendor ON meal_plans(vendor_id);

-- Holiday packages indexes
CREATE INDEX IF NOT EXISTS idx_holiday_packages_vendor ON holiday_packages(vendor_id);

-- Video call sessions indexes
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_booking ON video_call_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_vendor ON video_call_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_status ON video_call_sessions(status);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(is_published) WHERE is_published = true;

-- ============================================================================
-- 9. SCHEMA UPDATES (Add missing columns to existing tables)
-- ============================================================================

-- Add commission_amount to payments table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN commission_amount DECIMAL(10, 2) DEFAULT 0;
    COMMENT ON COLUMN payments.commission_amount IS 'Commission amount deducted from payment';
  END IF;
END $$;

-- Add total_amount to payments table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN total_amount DECIMAL(10, 2);
    COMMENT ON COLUMN payments.total_amount IS 'Total payment amount';
  END IF;
END $$;

-- Add category to products table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE products ADD COLUMN category VARCHAR(100);
    COMMENT ON COLUMN products.category IS 'Product category (medicine, food, accessory, etc.)';
  END IF;
END $$;

-- Add available_date to staff_availability table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_availability' AND column_name = 'available_date'
  ) THEN
    ALTER TABLE staff_availability ADD COLUMN available_date DATE;
    COMMENT ON COLUMN staff_availability.available_date IS 'Specific date for availability (for date-specific availability)';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- 
-- Verify tables created:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'prescriptions', 'medical_records', 'diagnostic_tests',
--   'service_packages', 'package_sessions', 'gps_tracking_sessions',
--   'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
--   'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
-- )
-- ORDER BY table_name;
--
-- Verify columns added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'payments' 
-- AND column_name IN ('commission_amount', 'total_amount');
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'products' 
-- AND column_name = 'category';
--
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'staff_availability' 
-- AND column_name = 'available_date';
-- ============================================================================

-- ============================================================================
-- CAPABILITY SYSTEM DATABASE TABLES
-- ============================================================================
-- All tables required for the vendor capability system
-- Run this migration to ensure all specialized capability tables exist
-- ============================================================================

-- ============================================
-- AMBULANCE VEHICLES
-- ============================================
CREATE TABLE IF NOT EXISTS ambulance_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(50) DEFAULT 'basic', -- basic, advanced, icu
  capacity INTEGER DEFAULT 2,
  equipment JSONB DEFAULT '[]',
  current_location JSONB,
  is_available BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  driver_name VARCHAR(255),
  driver_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_vendor ON ambulance_vehicles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_available ON ambulance_vehicles(is_available);

-- ============================================
-- DIAGNOSTIC TESTS
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  test_name VARCHAR(255) NOT NULL,
  test_code VARCHAR(50),
  category VARCHAR(100),
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  sample_type VARCHAR(50),
  preparation_instructions TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_vendor ON diagnostic_tests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(category);

-- ============================================
-- MEAL PLANS (Nutritionist)
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  pet_types JSONB DEFAULT '["dog", "cat"]',
  duration_days INTEGER DEFAULT 30,
  meals_per_day INTEGER DEFAULT 2,
  price DECIMAL(10,2) DEFAULT 0,
  meals JSONB DEFAULT '[]',
  nutritional_goals JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_vendor ON meal_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON meal_plans(is_active);

-- ============================================
-- MEAL PLAN ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plan_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  delivery_date DATE,
  delivery_time VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_orders_order ON meal_plan_orders(order_id);

-- ============================================
-- CAFE TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS cafe_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  table_number VARCHAR(50) NOT NULL,
  capacity INTEGER DEFAULT 4,
  section VARCHAR(100),
  location VARCHAR(255),
  is_outdoor BOOLEAN DEFAULT false,
  amenities JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'available', -- available, occupied, reserved
  is_active BOOLEAN DEFAULT true,
  max_concurrent_bookings INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cafe_tables_vendor ON cafe_tables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);

-- ============================================
-- CAFE MENU ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS cafe_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_vegetarian BOOLEAN DEFAULT false,
  is_pet_friendly BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cafe_menu_items_vendor ON cafe_menu_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cafe_menu_items_category ON cafe_menu_items(category);

-- ============================================
-- BOARDING ROOMS (Pet Resort)
-- ============================================
CREATE TABLE IF NOT EXISTS boarding_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  room_type VARCHAR(100) DEFAULT 'standard', -- standard, deluxe, suite
  capacity INTEGER DEFAULT 1,
  amenities JSONB DEFAULT '[]',
  price_per_night DECIMAL(10,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  current_occupant_pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_rooms_vendor ON boarding_rooms(vendor_id);
CREATE INDEX IF NOT EXISTS idx_boarding_rooms_available ON boarding_rooms(is_available);

-- ============================================
-- TRAINING PROGRAMS
-- ============================================
CREATE TABLE IF NOT EXISTS training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'obedience',
  duration_weeks INTEGER DEFAULT 4,
  sessions_per_week INTEGER DEFAULT 2,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_pets INTEGER DEFAULT 5,
  skill_level VARCHAR(50) DEFAULT 'beginner', -- beginner, intermediate, advanced
  is_active BOOLEAN DEFAULT true,
  enrolled_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_programs_vendor ON training_programs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_active ON training_programs(is_active);

-- ============================================
-- TRAINING PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'enrolled', -- enrolled, in_progress, completed, dropped
  progress_percentage INTEGER DEFAULT 0,
  sessions_completed INTEGER DEFAULT 0,
  notes TEXT,
  skills_learned JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_progress_program ON training_progress(program_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_pet ON training_progress(pet_id);

-- ============================================
-- HOLIDAY PACKAGES
-- ============================================
CREATE TABLE IF NOT EXISTS holiday_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  destination VARCHAR(255) NOT NULL,
  duration_days INTEGER DEFAULT 3,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_pets INTEGER DEFAULT 10,
  pet_types_allowed JSONB DEFAULT '["dog", "cat"]',
  includes JSONB DEFAULT '[]',
  excludes JSONB DEFAULT '[]',
  itinerary JSONB DEFAULT '[]',
  next_departure DATE,
  rating DECIMAL(3,2) DEFAULT 0,
  bookings_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holiday_packages_vendor ON holiday_packages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_holiday_packages_active ON holiday_packages(is_active);

-- ============================================
-- HOLIDAY BOOKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS holiday_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES holiday_packages(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pet_ids JSONB DEFAULT '[]',
  departure_date DATE NOT NULL,
  number_of_pets INTEGER DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  booking_status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  special_requirements TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holiday_bookings_package ON holiday_bookings(package_id);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_customer ON holiday_bookings(customer_id);

-- ============================================
-- INSURANCE PLANS
-- ============================================
CREATE TABLE IF NOT EXISTS insurance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  coverage_type VARCHAR(100), -- basic, comprehensive, premium
  coverage_amount DECIMAL(12,2) NOT NULL,
  premium_monthly DECIMAL(10,2) NOT NULL,
  premium_yearly DECIMAL(10,2),
  coverage_details JSONB DEFAULT '{}',
  exclusions JSONB DEFAULT '[]',
  waiting_period_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_plans_vendor ON insurance_plans(vendor_id);

-- ============================================
-- INSURANCE POLICIES
-- ============================================
CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  policy_number VARCHAR(100) UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  premium_amount DECIMAL(10,2) NOT NULL,
  payment_frequency VARCHAR(50) DEFAULT 'monthly',
  status VARCHAR(50) DEFAULT 'active', -- active, expired, cancelled, claimed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer ON insurance_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_pet ON insurance_policies(pet_id);

-- ============================================
-- INSURANCE CLAIMS
-- ============================================
CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  claim_number VARCHAR(100) UNIQUE NOT NULL,
  claim_type VARCHAR(100) NOT NULL, -- medical, accident, emergency
  claim_amount DECIMAL(10,2) NOT NULL,
  approved_amount DECIMAL(10,2),
  description TEXT,
  incident_date DATE NOT NULL,
  documents JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending', -- pending, under_review, approved, rejected, paid
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);

-- ============================================
-- EVENT REGISTRATIONS (already exists, ensure indexes)
-- ============================================
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vendor_id UUID,
  attendee_name VARCHAR(255) NOT NULL,
  attendee_email VARCHAR(255),
  attendee_phone VARCHAR(20) NOT NULL,
  number_of_people INTEGER DEFAULT 1,
  pets JSONB DEFAULT '[]',
  special_requirements TEXT,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'confirmed',
  booking_reference VARCHAR(100) UNIQUE,
  qr_code TEXT,
  check_in_status VARCHAR(50) DEFAULT 'pending',
  check_in_time TIMESTAMP,
  checked_in_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_customer ON event_registrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_booking_ref ON event_registrations(booking_reference);

-- ============================================
-- PRESCRIPTION DOWNLOADS (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS prescription_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  downloaded_by VARCHAR(255),
  downloaded_by_role VARCHAR(50),
  downloaded_by_name VARCHAR(255),
  downloaded_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_downloads_prescription ON prescription_downloads(prescription_id);

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================
-- Add any necessary RLS policies here if using Supabase/PostgreSQL RLS

-- ============================================
-- MIGRATION COMPLETE MESSAGE
-- ============================================
-- SELECT 'Capability tables migration completed successfully' as status;

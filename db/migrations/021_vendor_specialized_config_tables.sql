-- ============================================================================
-- VENDOR SPECIALIZED CONFIGURATION TABLES
-- ============================================================================
-- Tables for specialized vendor configurations:
-- - Ambulance vehicles
-- - Diagnostic tests catalog
-- - Meal plans (nutritionist)
-- - Boarding facilities config
-- ============================================================================

-- Ambulance Vehicles
CREATE TABLE IF NOT EXISTS ambulance_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    vehicle_number TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'basic' CHECK (vehicle_type IN ('basic', 'advanced', 'critical_care')),
    capacity INTEGER DEFAULT 2,
    equipment JSONB DEFAULT '[]'::jsonb,
    current_location JSONB, -- { lat, lng, address }
    is_available BOOLEAN DEFAULT true,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, vehicle_number)
);

CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_vendor_id ON ambulance_vehicles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_vehicles_available ON ambulance_vehicles(is_available);

-- Diagnostic Tests Catalog
CREATE TABLE IF NOT EXISTS diagnostic_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_code TEXT,
    category TEXT, -- blood, urine, imaging, etc.
    description TEXT,
    price NUMERIC(10, 2),
    duration_minutes INTEGER,
    sample_type TEXT, -- blood, urine, stool, etc.
    preparation_instructions TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_vendor_id ON diagnostic_tests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(category);

-- Meal Plans (Nutritionist)
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    description TEXT,
    meals JSONB DEFAULT '[]'::jsonb, -- Array of meal configurations
    nutritional_goals JSONB DEFAULT '{}'::jsonb, -- { calories, protein, fat, carbs }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_vendor_id ON meal_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON meal_plans(is_active);

-- Boarding Facilities Config (stored per vendor)
CREATE TABLE IF NOT EXISTS boarding_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    has_daycare BOOLEAN DEFAULT false,
    has_boarding BOOLEAN DEFAULT false,
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_boarding_facilities_vendor_id ON boarding_facilities(vendor_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_vendor_specialized_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ambulance_vehicles_updated_at
    BEFORE UPDATE ON ambulance_vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

CREATE TRIGGER trigger_update_diagnostic_tests_updated_at
    BEFORE UPDATE ON diagnostic_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

CREATE TRIGGER trigger_update_meal_plans_updated_at
    BEFORE UPDATE ON meal_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

CREATE TRIGGER trigger_update_boarding_facilities_updated_at
    BEFORE UPDATE ON boarding_facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();


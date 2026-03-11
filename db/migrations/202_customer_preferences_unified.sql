-- ============================================================================
-- CUSTOMER PREFERENCES - UNIFIED MODEL
-- ============================================================================
-- Stores customer onboarding questionnaire data, lifestyle preferences,
-- and budget information to provide personalized recommendations.
-- 
-- Date: 2026-01-20
-- ============================================================================

-- Customer Preferences Table
CREATE TABLE IF NOT EXISTS customer_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Onboarding Journey Type
    journey_type TEXT CHECK (journey_type IN ('planning', 'have-pet', 'end-of-life')),
    
    -- Living Space
    home_type TEXT CHECK (home_type IN ('apartment', 'small-house', 'large-house', 'farm', 'other')),
    outdoor_space TEXT CHECK (outdoor_space IN ('large-yard', 'small-patio', 'balcony', 'no-outdoor')),
    
    -- Lifestyle
    work_schedule TEXT CHECK (work_schedule IN ('work-from-home', 'away-4-6', 'away-8-plus', 'flexible', 'shift-work')),
    activity_level TEXT CHECK (activity_level IN ('very-active', 'moderate', 'relaxed', 'varies')),
    travel_frequency TEXT CHECK (travel_frequency IN ('rarely', 'few-times', 'monthly', 'weekly')),
    
    -- Budget
    monthly_budget TEXT CHECK (monthly_budget IN ('3000-6000', '6000-12000', '12000-20000', '20000-plus')),
    
    -- Service Preferences (JSONB for flexibility)
    service_preferences JSONB DEFAULT '[]'::jsonb,  -- e.g., ['grooming', 'walking', 'training', 'vet-care']
    
    -- Communication Preferences
    preferred_language TEXT DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "push": true}'::jsonb,
    
    -- Pet Care Preferences
    preferred_vet_style TEXT CHECK (preferred_vet_style IN ('clinic', 'home-visit', 'tele', 'no-preference')),
    preferred_grooming_style TEXT CHECK (preferred_grooming_style IN ('salon', 'home-visit', 'mobile', 'no-preference')),
    
    -- Family Context
    has_children BOOLEAN,
    has_other_pets BOOLEAN,
    other_pet_types TEXT[], -- e.g., ['dog', 'cat', 'bird']
    
    -- Timestamps
    onboarding_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Only one preferences record per customer
    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_journey ON customer_preferences(journey_type);

COMMENT ON TABLE customer_preferences IS 'Customer onboarding and lifestyle preferences for personalized recommendations';

-- Add onboarding_data JSONB column to customers table for flexible storage
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'INIT';

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

COMMENT ON COLUMN customers.preferences IS 'JSONB field for flexible customer preferences storage';
COMMENT ON COLUMN customers.onboarding_status IS 'Customer onboarding state: INIT, IN_PROGRESS, COMPLETED';
COMMENT ON COLUMN customers.profile_completed IS 'Whether customer has completed their profile';

-- Add missing columns to pets table for enhanced pet model
ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS size TEXT CHECK (size IN ('Small', 'Medium', 'Large', 'Giant'));

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS microchip_id TEXT;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS coat_type TEXT;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS vaccination_records JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS behavior_notes TEXT;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS is_spayed_neutered BOOLEAN DEFAULT false;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS activity_level TEXT CHECK (activity_level IN ('Low', 'Medium', 'High'));

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS temperament TEXT;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS dietary_restrictions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS insurance_info JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pets.color IS 'Pet coat/fur color';
COMMENT ON COLUMN pets.size IS 'Pet size category';
COMMENT ON COLUMN pets.date_of_birth IS 'Pet date of birth for accurate age calculation';
COMMENT ON COLUMN pets.microchip_id IS 'Pet microchip identification number';
COMMENT ON COLUMN pets.vaccination_records IS 'Array of vaccination records with name, date, and next due date';
COMMENT ON COLUMN pets.behavior_notes IS 'Special behavior notes and requirements';
COMMENT ON COLUMN pets.is_spayed_neutered IS 'Whether pet is spayed/neutered';
COMMENT ON COLUMN pets.activity_level IS 'Pet activity level preference';
COMMENT ON COLUMN pets.temperament IS 'Pet temperament description';
COMMENT ON COLUMN pets.dietary_restrictions IS 'Array of dietary restrictions/allergies';
COMMENT ON COLUMN pets.insurance_info IS 'Pet insurance details if applicable';

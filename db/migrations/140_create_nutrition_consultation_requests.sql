-- ============================================================================
-- Migration: Create nutrition_consultation_requests table
-- Description: Stores customer consultation requests for nutrition vendors
-- Date: 2026-01-16
-- Feature: Free consultation booking flow for nutrition services
-- ============================================================================

-- Create nutrition_consultation_requests table
CREATE TABLE IF NOT EXISTS nutrition_consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  
  -- Consultation Form Data
  main_goals TEXT NOT NULL,
  budget_range_min NUMERIC(10, 2),
  budget_range_max NUMERIC(10, 2),
  preferred_proteins TEXT[] DEFAULT '{}',
  delivery_preference TEXT,
  preferred_start_date DATE,
  dietary_restrictions TEXT[] DEFAULT '{}',
  special_notes TEXT,
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'reviewed', 'plan_created', 'accepted', 'rejected', 'cancelled')),
  
  -- Response from Nutritionist
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  nutritionist_notes TEXT,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- Add comments
COMMENT ON TABLE nutrition_consultation_requests IS 'Stores customer consultation requests for nutrition vendors';
COMMENT ON COLUMN nutrition_consultation_requests.main_goals IS 'Customer main goals (e.g., Weight loss, better digestion)';
COMMENT ON COLUMN nutrition_consultation_requests.budget_range_min IS 'Minimum budget per month in INR';
COMMENT ON COLUMN nutrition_consultation_requests.budget_range_max IS 'Maximum budget per month in INR';
COMMENT ON COLUMN nutrition_consultation_requests.preferred_proteins IS 'Array of preferred protein sources';
COMMENT ON COLUMN nutrition_consultation_requests.delivery_preference IS 'Delivery frequency (e.g., Every 3 days, Weekly)';
COMMENT ON COLUMN nutrition_consultation_requests.status IS 'Request status: pending, reviewed, plan_created, accepted, rejected, cancelled';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_customer ON nutrition_consultation_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_vendor ON nutrition_consultation_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_status ON nutrition_consultation_requests(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_created ON nutrition_consultation_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultation_pet ON nutrition_consultation_requests(pet_id) WHERE pet_id IS NOT NULL;

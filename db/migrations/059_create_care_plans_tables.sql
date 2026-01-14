-- ============================================================================
-- MIGRATION 059: CREATE CARE PLANS TABLES
-- ============================================================================
-- 
-- Creates tables for pet care plan management:
-- - pet_care_plans: Main plans table
-- - care_plan_items: Individual plan items/steps
-- - care_plan_templates: Reusable plan templates
-- 
-- Date: 2026-01-28
-- Related: Complete Plan feature in Support/CRM
-- ============================================================================

-- Main Care Plans Table
CREATE TABLE IF NOT EXISTS pet_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL, -- Link to support ticket
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('wellness', 'treatment', 'nutrition', 'training', 'general')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_by UUID, -- Support agent/admin user ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ai_generated BOOLEAN DEFAULT false,
  plan_data JSONB, -- Stores structured plan details, AI prompt, etc.
  
  -- Indexes
  CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_pet FOREIGN KEY (pet_id) REFERENCES pets(id),
  CONSTRAINT fk_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);

CREATE INDEX idx_care_plans_customer ON pet_care_plans(customer_id);
CREATE INDEX idx_care_plans_pet ON pet_care_plans(pet_id);
CREATE INDEX idx_care_plans_ticket ON pet_care_plans(ticket_id);
CREATE INDEX idx_care_plans_status ON pet_care_plans(status);
CREATE INDEX idx_care_plans_type ON pet_care_plans(plan_type);

-- Plan Items/Steps Table
CREATE TABLE IF NOT EXISTS care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES pet_care_plans(id) ON DELETE CASCADE,
  item_type VARCHAR(50) CHECK (item_type IN ('medication', 'exercise', 'diet', 'checkup', 'training', 'grooming', 'other')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_plan FOREIGN KEY (plan_id) REFERENCES pet_care_plans(id) ON DELETE CASCADE
);

CREATE INDEX idx_plan_items_plan ON care_plan_items(plan_id);
CREATE INDEX idx_plan_items_scheduled ON care_plan_items(scheduled_date);
CREATE INDEX idx_plan_items_completed ON care_plan_items(completed);

-- Plan Templates Table (for reusable plans)
CREATE TABLE IF NOT EXISTS care_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('wellness', 'treatment', 'nutrition', 'training', 'general')),
  pet_type VARCHAR(50), -- 'dog', 'cat', etc.
  condition VARCHAR(255), -- 'post-surgery', 'weight-loss', 'puppy-care', etc.
  description TEXT,
  template_data JSONB NOT NULL, -- Stores the plan structure
  is_active BOOLEAN DEFAULT true,
  created_by UUID, -- Admin user ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON care_plan_templates(plan_type);
CREATE INDEX idx_templates_pet_type ON care_plan_templates(pet_type);
CREATE INDEX idx_templates_active ON care_plan_templates(is_active);

-- Add updated_at trigger for pet_care_plans
CREATE OR REPLACE FUNCTION update_care_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_care_plans_updated_at
  BEFORE UPDATE ON pet_care_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_care_plans_updated_at();

-- Add updated_at trigger for care_plan_templates
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_templates_updated_at
  BEFORE UPDATE ON care_plan_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

-- Insert some default templates
INSERT INTO care_plan_templates (name, plan_type, pet_type, condition, description, template_data, is_active) VALUES
(
  'Post-Surgery Recovery Plan',
  'treatment',
  'dog',
  'post-surgery',
  'Standard recovery plan for dogs after surgery',
  '{
    "items": [
      {"type": "medication", "title": "Administer pain medication", "description": "Give prescribed pain medication as directed", "order_index": 1},
      {"type": "checkup", "title": "Follow-up vet visit", "description": "Schedule follow-up appointment", "order_index": 2},
      {"type": "exercise", "title": "Restricted activity", "description": "Limit physical activity as per vet instructions", "order_index": 3},
      {"type": "diet", "title": "Special diet", "description": "Follow post-surgery dietary guidelines", "order_index": 4}
    ],
    "duration_days": 14
  }'::jsonb,
  true
),
(
  'Puppy Wellness Plan',
  'wellness',
  'dog',
  'puppy-care',
  'Comprehensive wellness plan for puppies',
  '{
    "items": [
      {"type": "checkup", "title": "Vaccination schedule", "description": "Follow recommended vaccination timeline", "order_index": 1},
      {"type": "diet", "title": "Puppy nutrition", "description": "Feed age-appropriate puppy food", "order_index": 2},
      {"type": "training", "title": "Basic training", "description": "Start basic obedience training", "order_index": 3},
      {"type": "grooming", "title": "Regular grooming", "description": "Establish grooming routine", "order_index": 4}
    ],
    "duration_days": 90
  }'::jsonb,
  true
),
(
  'Weight Management Plan',
  'nutrition',
  'dog',
  'weight-loss',
  'Plan for healthy weight management',
  '{
    "items": [
      {"type": "diet", "title": "Controlled feeding", "description": "Measure meals and follow feeding schedule", "order_index": 1},
      {"type": "exercise", "title": "Daily walks", "description": "30-45 minute walks twice daily", "order_index": 2},
      {"type": "checkup", "title": "Monthly weigh-in", "description": "Track weight progress monthly", "order_index": 3}
    ],
    "duration_days": 60
  }'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE pet_care_plans IS 'Main table for pet care plans generated by support agents or AI';
COMMENT ON TABLE care_plan_items IS 'Individual items/steps within a care plan';
COMMENT ON TABLE care_plan_templates IS 'Reusable plan templates for common conditions';

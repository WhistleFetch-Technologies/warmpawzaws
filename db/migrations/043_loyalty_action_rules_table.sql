-- ============================================================================
-- MIGRATION 043: Loyalty Action Rules Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create table for action-based loyalty point rules
-- ============================================================================

-- Loyalty Action Rules
-- Defines points earned for specific actions
CREATE TABLE IF NOT EXISTS loyalty_action_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_name TEXT NOT NULL UNIQUE,
    action_category TEXT NOT NULL CHECK (action_category IN ('loyalty', 'referral_rewards')),
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'vendor', 'both')),
    
    -- Point Calculation
    points_type TEXT NOT NULL CHECK (points_type IN ('fixed', 'percentage', 'per_amount')),
    points_value NUMERIC(10, 2) NOT NULL, -- Fixed points or percentage or points per amount
    base_amount NUMERIC(10, 2), -- For percentage/per_amount calculations
    min_amount NUMERIC(10, 2), -- Minimum amount to earn points
    max_points_per_transaction INTEGER, -- Maximum points per transaction
    
    -- Frequency/Limits
    frequency_type TEXT CHECK (frequency_type IN ('one_time', 'recurring', 'unlimited', 'monthly_limit', 'yearly_limit')),
    frequency_limit INTEGER, -- Max times or max per period
    frequency_period TEXT CHECK (frequency_period IN ('day', 'week', 'month', 'year')),
    
    -- Conditions
    conditions JSONB DEFAULT '{}'::jsonb, -- Additional conditions (e.g., first_purchase, birthday_month, etc.)
    multiplier_conditions JSONB DEFAULT '{}'::jsonb, -- Conditions for multipliers (e.g., birthday_month: 2x)
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100, -- Higher priority rules checked first
    
    -- Metadata
    description TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_action_name ON loyalty_action_rules(action_name);
CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_category ON loyalty_action_rules(action_category);
CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_user_type ON loyalty_action_rules(user_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_active ON loyalty_action_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_priority ON loyalty_action_rules(priority DESC) WHERE is_active = true;

-- Comments
COMMENT ON TABLE loyalty_action_rules IS 'Action-based loyalty point rules - defines points earned for specific user actions';
COMMENT ON COLUMN loyalty_action_rules.action_name IS 'Unique action identifier (e.g., signup, complete_profile, buy_medicine)';
COMMENT ON COLUMN loyalty_action_rules.points_type IS 'How points are calculated: fixed, percentage, or per_amount';
COMMENT ON COLUMN loyalty_action_rules.points_value IS 'Points value: fixed points, percentage (0-100), or points per base_amount';
COMMENT ON COLUMN loyalty_action_rules.base_amount IS 'Base amount for percentage/per_amount calculations (e.g., 1000 for "10 points per ₹1000")';
COMMENT ON COLUMN loyalty_action_rules.frequency_type IS 'How often points can be earned: one_time, recurring, unlimited, monthly_limit, yearly_limit';
COMMENT ON COLUMN loyalty_action_rules.conditions IS 'Additional conditions (JSONB): first_purchase, birthday_month, verified_review, etc.';
COMMENT ON COLUMN loyalty_action_rules.multiplier_conditions IS 'Conditions for point multipliers (JSONB): birthday_month: 2, etc.';

-- Insert default rules based on requirements
INSERT INTO loyalty_action_rules (action_name, action_category, user_type, points_type, points_value, base_amount, frequency_type, description, notes) VALUES
-- Customer Loyalty Rules
('signup', 'loyalty', 'customer', 'fixed', 100, NULL, 'one_time', 'Sign up on Warmpawz', 'Welcome bonus'),
('complete_pet_profile', 'loyalty', 'customer', 'fixed', 100, NULL, 'one_time', 'Complete pet profile', 'For first pet'),
('update_health_record', 'loyalty', 'customer', 'fixed', 50, NULL, 'recurring', 'Update Last Health Record Digitally', 'Encourages digilocker of all health data'),
('buy_medicine', 'loyalty', 'customer', 'per_amount', 10, 1000, 'recurring', 'Buy Medicines', '10 points per ₹1000 spent'),
('refer_friend', 'loyalty', 'customer', 'fixed', 100, NULL, 'recurring', 'Refer a friend who joins', 'Friend must complete 1 booking'),
('buy_insurance', 'loyalty', 'customer', 'per_amount', 50, 1000, 'one_time', 'Buy Pet Insurance', 'Must buy from platform'),
('renew_insurance', 'loyalty', 'customer', 'per_amount', 100, 1000, 'recurring', 'Renew Pet Insurance', 'Promotes retention'),
('book_grooming', 'loyalty', 'customer', 'per_amount', 5, 1000, 'unlimited', 'Book a grooming service', 'Includes doorstep and center bookings'),
('book_vet_consultation', 'loyalty', 'customer', 'per_amount', 7, 500, 'unlimited', 'Book a vet consultation', 'In-clinic or online'),
('purchase_pet_food', 'loyalty', 'customer', 'per_amount', 3, 1000, 'unlimited', 'Purchase pet food', 'Via platform partners'),
('book_nutrition_consultation', 'loyalty', 'customer', 'per_amount', 5, 1000, 'unlimited', 'Book a Nutrition Consultation', 'Via platform partners'),
('post_review', 'loyalty', 'customer', 'fixed', 500, NULL, 'monthly_limit', 'Post a verified review', 'Max 3/month - Encourages engagement'),
('birthday_month_booking', 'loyalty', 'customer', 'fixed', 0, NULL, 'yearly_limit', 'Birthday month booking', '2x points multiplier - Based on registered pet birthday'),
('buy_first_product', 'loyalty', 'customer', 'per_amount', 50, 1000, 'one_time', 'Buy a first product', 'Welcome bonus for E-Commerce'),
('buy_product', 'loyalty', 'customer', 'per_amount', 10, 1000, 'unlimited', 'Buy a product', 'Via platform partners'),

-- Vendor Referral Rewards
('vendor_signup', 'referral_rewards', 'vendor', 'fixed', 100, NULL, 'one_time', 'Signup on Warmpawz', 'Welcome bonus'),
('vendor_refer_friend', 'referral_rewards', 'vendor', 'fixed', 200, NULL, 'recurring', 'Refer a friend who joins', 'Friend must Onboard 1 End User and complete 1 booking'),
('vendor_refer_existing_customer', 'referral_rewards', 'vendor', 'fixed', 500, NULL, 'unlimited', 'Refer an Existing Customer to Signup and buy any one service', 'Acquire new clients and reduce CAC'),
('vendor_subscribe_premium', 'referral_rewards', 'vendor', 'fixed', 1000, NULL, 'one_time', 'Subscribe to Premium Plan', 'Bonus for loyalty')
ON CONFLICT (action_name) DO NOTHING;

-- Update existing loyalty_rules to support auto-conversion
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS auto_convert_to_wallet BOOLEAN DEFAULT true;
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5, 2) DEFAULT 1.0; -- 1 point = 1 rupee

COMMENT ON COLUMN loyalty_rules.auto_convert_to_wallet IS 'Automatically convert earned points to wallet balance (1 point = 1 rupee)';
COMMENT ON COLUMN loyalty_rules.conversion_rate IS 'Conversion rate: points to rupees (default: 1.0 = 1 point = 1 rupee)';


-- ============================================================================
-- MIGRATION 065: Update Loyalty Rules with Segment References
-- ============================================================================
-- Date: 2025-01-12
-- Purpose: Update default loyalty rules to use segments instead of plain category names
-- ============================================================================

-- First, ensure segments exist (they should from migration 064)
-- If segments don't exist, create them

-- Update loyalty_action_rules to use segment_ids in conditions
-- This migration updates existing rules to reference segments by ID

-- Example: Update "buy_medicine" rule to use "Medicine Buyers" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Medicine Buyers'
  )
)
WHERE action_name = 'buy_medicine'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "book_grooming" rule to use "Grooming Service Users" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Grooming Service Users'
  )
)
WHERE action_name = 'book_grooming'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "book_vet_consultation" rule to use "Vet Consultation Users" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Vet Consultation Users'
  )
)
WHERE action_name = 'book_vet_consultation'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "purchase_pet_food" rule to use "Pet Food Buyers" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Pet Food Buyers'
  )
)
WHERE action_name = 'purchase_pet_food'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "buy_insurance" rule to use "Insurance Buyers" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Insurance Buyers'
  )
)
WHERE action_name = 'buy_insurance'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "buy_first_product" rule to use "First Time Buyers" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'First Time Buyers'
  )
)
WHERE action_name = 'buy_first_product'
  AND (conditions->>'segment_ids') IS NULL;

-- Update "birthday_month_booking" rule to use "Birthday Month Customers" segment
UPDATE loyalty_action_rules
SET conditions = jsonb_set(
  COALESCE(conditions, '{}'::jsonb),
  '{segment_ids}',
  (
    SELECT jsonb_agg(id::text)
    FROM loyalty_segments
    WHERE segment_name = 'Birthday Month Customers'
  )
)
WHERE action_name = 'birthday_month_booking'
  AND (conditions->>'segment_ids') IS NULL;

-- Note: Rules can have both segment_ids AND other conditions
-- The rule engine will evaluate segments first, then other conditions
-- This allows for flexible rule combinations

COMMENT ON COLUMN loyalty_action_rules.conditions IS 'JSONB conditions including segment_ids (array of segment UUIDs), service_categories, customer_tiers, etc.';

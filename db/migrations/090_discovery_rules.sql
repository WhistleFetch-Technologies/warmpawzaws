-- ============================================================================
-- MIGRATION 090: DISCOVERY RULES (RULE ENGINE)
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Configurable rule book for discovery, pharmacy broadcast, and
--          appointment/post-appointment behaviour (replace hardcoded values).
-- See: docs/RULE_ENGINE_DISCOVERY_AND_SERVICES_PROPOSAL.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  rule_value JSONB NOT NULL,
  applies_to_flow TEXT DEFAULT '',
  city TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, rule_key, applies_to_flow, city)
);

CREATE INDEX IF NOT EXISTS idx_discovery_rules_role ON discovery_rules(role_id);
CREATE INDEX IF NOT EXISTS idx_discovery_rules_key ON discovery_rules(rule_key);
CREATE INDEX IF NOT EXISTS idx_discovery_rules_flow ON discovery_rules(applies_to_flow) WHERE applies_to_flow IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discovery_rules_active ON discovery_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE discovery_rules IS 'Rule book: discovery radius, max results, sort, broadcast steps, follow-up/chat/review/booking timing per role';

-- ============================================================================
-- SEED: Discovery defaults per role
-- ============================================================================

INSERT INTO discovery_rules (role_id, rule_key, rule_value, applies_to_flow, is_active) VALUES
  ('walker', 'discovery_radius_km', '{"value": 10}', 'discover', true),
  ('walker', 'discovery_max_results', '{"value": 20}', 'discover', true),
  ('walker', 'discovery_sort_default', '{"value": "nearest"}', 'discover', true),
  ('walker', 'discovery_location_source', '{"value": "mobile"}', 'discover', true),

  ('pet_walker', 'discovery_radius_km', '{"value": 10}', 'discover', true),
  ('pet_walker', 'discovery_max_results', '{"value": 20}', 'discover', true),
  ('pet_walker', 'discovery_sort_default', '{"value": "nearest"}', 'discover', true),

  ('pet_nutritionist', 'discovery_radius_km', '{"value": 10}', 'meal_search', true),
  ('pet_nutritionist', 'discovery_max_results', '{"value": 50}', 'meal_search', true),
  ('pet_nutritionist', 'discovery_sort_default', '{"value": "nearest"}', 'meal_search', true),
  ('pet_nutritionist', 'hyperlocal_max_distance_km', '{"value": 10}', 'meal_search', true),
  ('pet_nutritionist', 'order_accept_max_distance_km', '{"value": 10}', 'meal_order', true),

  ('nutritionist', 'discovery_radius_km', '{"value": 10}', 'meal_search', true),
  ('nutritionist', 'discovery_max_results', '{"value": 50}', 'meal_search', true),
  ('nutritionist', 'hyperlocal_max_distance_km', '{"value": 10}', 'meal_search', true),

  ('veterinarian', 'discovery_radius_km', '{"value": 25}', 'discover', true),
  ('veterinarian', 'discovery_max_results', '{"value": 50}', 'discover', true),
  ('veterinarian', 'discovery_sort_default', '{"value": "relevance"}', 'discover', true),
  ('vet_clinic', 'discovery_radius_km', '{"value": 25}', 'discover', true),
  ('vet_clinic', 'discovery_max_results', '{"value": 50}', 'discover', true),

  ('groomer', 'discovery_radius_km', '{"value": 15}', 'discover', true),
  ('groomer', 'discovery_max_results', '{"value": 30}', 'discover', true),
  ('groomer', 'discovery_sort_default', '{"value": "nearest"}', 'discover', true),

  ('trainer', 'discovery_radius_km', '{"value": 15}', 'discover', true),
  ('trainer', 'discovery_max_results', '{"value": 30}', 'discover', true),
  ('trainer', 'discovery_sort_default', '{"value": "nearest"}', 'discover', true),

  ('pharmacy', 'broadcast_radius_km_initial', '{"value": 5}', 'pharmacy_broadcast', true),
  ('pharmacy', 'broadcast_radius_km_steps', '{"value": [5, 10, 20]}', 'pharmacy_broadcast', true)
ON CONFLICT (role_id, rule_key, applies_to_flow, city) DO NOTHING;

-- ============================================================================
-- SEED: Appointment & post-appointment defaults (role 'all' = global)
-- ============================================================================

INSERT INTO discovery_rules (role_id, rule_key, rule_value, applies_to_flow, is_active) VALUES
  ('all', 'follow_up_days', '{"value": 7}', 'booking', true),
  ('all', 'chat_available_days_post_appointment', '{"value": 7}', 'chat', true),
  ('all', 'chat_available_before_appointment_minutes', '{"value": 5}', 'booking', true),
  ('all', 'review_eligible_days', '{"value": 7}', 'reviews', true),
  ('all', 'booking_min_notice_hours', '{"value": 1}', 'booking', true),
  ('all', 'appointment_reminder_minutes_before', '{"value": 5}', 'booking', true),
  ('all', 'video_call_grace_period_minutes', '{"value": 5}', 'video_call', true)
ON CONFLICT (role_id, rule_key, applies_to_flow, city) DO NOTHING;

-- ============================================================================
-- SEED: Default discovery for generic discover flow (fallback when no role)
-- ============================================================================

INSERT INTO discovery_rules (role_id, rule_key, rule_value, applies_to_flow, is_active) VALUES
  ('all', 'discovery_radius_km', '{"value": 50}', 'discover', true),
  ('all', 'discovery_max_results', '{"value": 50}', 'discover', true),
  ('all', 'discovery_sort_default', '{"value": "relevance"}', 'discover', true),
  ('all', 'discovery_location_source', '{"value": "mobile_then_base"}', 'discover', true)
ON CONFLICT (role_id, rule_key, applies_to_flow, city) DO NOTHING;

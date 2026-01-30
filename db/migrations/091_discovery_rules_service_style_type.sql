-- ============================================================================
-- MIGRATION 091: Discovery rules – service_style and service_type
-- ============================================================================
-- Purpose: Allow rules to be scoped by service style (at_home, at_center, tele)
--          and optionally by service type/category (grooming, training, etc.).
-- See: docs/RULE_ENGINE_ATTRIBUTE_AND_SERVICE_MAPPING_PROPOSAL.md
-- ============================================================================

-- Add columns (empty string = applies to all styles/types)
ALTER TABLE discovery_rules
  ADD COLUMN IF NOT EXISTS service_style TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT '';

-- Drop existing unique constraint (PostgreSQL default name)
ALTER TABLE discovery_rules
  DROP CONSTRAINT IF EXISTS discovery_rules_role_id_rule_key_applies_to_flow_city_key;

-- Add new unique constraint including service_style and service_type
ALTER TABLE discovery_rules
  ADD CONSTRAINT discovery_rules_role_key_flow_city_style_type_key
  UNIQUE (role_id, rule_key, applies_to_flow, city, service_style, service_type);

-- Indexes for filter/resolution
CREATE INDEX IF NOT EXISTS idx_discovery_rules_service_style
  ON discovery_rules(service_style) WHERE COALESCE(service_style, '') <> '';
CREATE INDEX IF NOT EXISTS idx_discovery_rules_service_type
  ON discovery_rules(service_type) WHERE COALESCE(service_type, '') <> '';

COMMENT ON COLUMN discovery_rules.service_style IS 'Optional: at_home | at_center | tele; empty = all styles';
COMMENT ON COLUMN discovery_rules.service_type IS 'Optional: grooming | training | veterinary | etc.; empty = all types';

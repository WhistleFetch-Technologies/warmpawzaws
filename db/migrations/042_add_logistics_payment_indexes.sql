-- ============================================================================
-- MIGRATION 042: Add Indexes for Logistics and Payment Gateway Tables
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add performance indexes for logistics and payment gateway queries
-- ============================================================================

-- Logistics Partners Indexes
CREATE INDEX IF NOT EXISTS idx_logistics_partners_partner_id ON logistics_partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_logistics_partners_partner_type ON logistics_partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_logistics_partners_enabled ON logistics_partners(enabled) WHERE enabled = true;

-- Logistics Rules Indexes
CREATE INDEX IF NOT EXISTS idx_logistics_rules_rule_name ON logistics_rules(rule_name);
CREATE INDEX IF NOT EXISTS idx_logistics_rules_rule_type ON logistics_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_logistics_rules_is_active ON logistics_rules(is_active) WHERE is_active = true;

-- Payment Gateway Settings Indexes
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_gateway_name ON payment_gateway_settings(gateway_name);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_gateway_type ON payment_gateway_settings(gateway_type);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_enabled ON payment_gateway_settings(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_test_mode ON payment_gateway_settings(test_mode);

-- Comments
COMMENT ON INDEX idx_logistics_partners_partner_id IS 'Index for quick lookup by partner_id';
COMMENT ON INDEX idx_logistics_partners_enabled IS 'Partial index for enabled partners only';
COMMENT ON INDEX idx_logistics_rules_is_active IS 'Partial index for active rules only';
COMMENT ON INDEX idx_payment_gateway_settings_enabled IS 'Partial index for enabled gateways only';


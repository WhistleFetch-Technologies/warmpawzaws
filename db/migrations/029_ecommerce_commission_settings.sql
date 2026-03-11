-- ============================================================================
-- MIGRATION 029: Ecommerce Commission Settings
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create ecommerce_commission_settings table for commission configuration
-- Migration: KV to SQL - Ecommerce Data
-- ============================================================================

-- Ecommerce Commission Settings Table (Singleton pattern - only one record)
CREATE TABLE IF NOT EXISTS ecommerce_commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  default_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
  rules JSONB NOT NULL DEFAULT '[]',
  vendor_tiers JSONB NOT NULL DEFAULT '[]',
  seller_rates JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ecommerce_commission_settings IS 'Ecommerce commission settings - replaces ecommerce:commission_settings KV key';
COMMENT ON COLUMN ecommerce_commission_settings.setting_key IS 'Singleton key - always "default"';
COMMENT ON COLUMN ecommerce_commission_settings.default_rate IS 'Default commission rate percentage';
COMMENT ON COLUMN ecommerce_commission_settings.rules IS 'Array of commission rules [{category, rate, minAmount, ...}]';
COMMENT ON COLUMN ecommerce_commission_settings.vendor_tiers IS 'Vendor tier-based commission rates';
COMMENT ON COLUMN ecommerce_commission_settings.seller_rates IS 'Individual seller commission rates {sellerId: rate}';

-- Insert default settings if not exists
INSERT INTO ecommerce_commission_settings (setting_key, default_rate, rules, vendor_tiers, seller_rates)
VALUES ('default', 15.00, '[]', '[]', '{}')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_ecommerce_commission_settings_key ON ecommerce_commission_settings(setting_key);


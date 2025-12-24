-- Migration: Add config JSONB column to roles table for SQL-only role configuration
-- Replaces KV store usage for role:config:${roleId}

ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_roles_config ON roles USING GIN (config);

COMMENT ON COLUMN roles.config IS 'Full role configuration (vendorTypes, serviceStyles, capabilities, pricingControl, sections, etc.) - replaces role:config:${roleId} KV key';


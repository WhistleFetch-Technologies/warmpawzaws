-- ============================================================================
-- PAYMENT_GATEWAY_SETTINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    gateway_name TEXT NOT NULL,
    gateway_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE payment_gateway_settings ADD CONSTRAINT payment_gateway_settings_gateway_name_key UNIQUE (gateway_name);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX payment_gateway_settings_pkey ON public.payment_gateway_settings USING btree (id);
CREATE UNIQUE INDEX payment_gateway_settings_gateway_name_key ON public.payment_gateway_settings USING btree (gateway_name);
CREATE INDEX idx_payment_gateway_settings_active ON public.payment_gateway_settings USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_gateway_settings IS 'Payment gateway settings - maps from admin:settings:payment_gateway, platform:settings:payment_gateway KV keys';
COMMENT ON COLUMN payment_gateway_settings.gateway_name IS 'Gateway name: razorpay, stripe, etc. (unique)';
COMMENT ON COLUMN payment_gateway_settings.gateway_config IS 'Gateway configuration: API keys, secrets, etc. (JSONB)';
COMMENT ON COLUMN payment_gateway_settings.is_active IS 'Whether gateway is active';
COMMENT ON COLUMN payment_gateway_settings.is_test_mode IS 'Whether gateway is in test mode';

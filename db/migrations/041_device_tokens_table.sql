-- Migration: Device Tokens Table for Push Notifications
-- Date: 2025-01-02

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'vendor', 'staff', 'admin')),
    device_id TEXT NOT NULL, -- Unique device identifier
    fcm_token TEXT NOT NULL, -- Firebase Cloud Messaging token
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
    app_version TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, user_type, device_id)
);

-- Index for looking up user devices
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id, user_type, is_active);

-- Index for FCM token lookup (for deactivating invalid tokens)
CREATE INDEX IF NOT EXISTS idx_device_tokens_fcm ON device_tokens(fcm_token);

-- Cleanup old inactive tokens automatically (optional - run periodically)
-- DELETE FROM device_tokens WHERE is_active = false AND updated_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE device_tokens IS 'Stores FCM tokens for push notifications to mobile/web devices';
COMMENT ON COLUMN device_tokens.fcm_token IS 'Firebase Cloud Messaging token for the device';
COMMENT ON COLUMN device_tokens.device_id IS 'Unique device identifier to prevent duplicate registrations';


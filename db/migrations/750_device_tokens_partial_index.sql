-- Migration: Add partial index on device_tokens for active token lookups
-- This optimises the hot-path query used by the notification delivery service:
-- WHERE user_id = $1 AND user_type = $2 AND is_active = true
CREATE INDEX IF NOT EXISTS idx_device_tokens_active_user
ON device_tokens(user_id, user_type)
WHERE is_active = true;

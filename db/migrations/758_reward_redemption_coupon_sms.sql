-- ============================================================================
-- 758: Track coupon-link SMS delivery on reward_redemptions
-- ============================================================================
-- One transactional SMS per external_link redemption (idempotency + audit).
-- Idempotent.
-- ============================================================================

ALTER TABLE reward_redemptions
    ADD COLUMN IF NOT EXISTS coupon_sms_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS coupon_sms_message_id TEXT,
    ADD COLUMN IF NOT EXISTS coupon_sms_status TEXT;

COMMENT ON COLUMN reward_redemptions.coupon_sms_sent_at IS
    'When the coupon link SMS was successfully sent via SNS';
COMMENT ON COLUMN reward_redemptions.coupon_sms_message_id IS
    'AWS SNS MessageId for the coupon link SMS';
COMMENT ON COLUMN reward_redemptions.coupon_sms_status IS
    'pending | sent | failed | skipped';

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_coupon_sms_pending
    ON reward_redemptions (id)
    WHERE coupon_sms_status = 'pending';

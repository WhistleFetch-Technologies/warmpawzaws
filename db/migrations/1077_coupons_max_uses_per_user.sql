-- Add per-customer coupon usage limit (Admin "Usage per customer").
-- Idempotent / additive only.

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER;

COMMENT ON COLUMN coupons.max_uses_per_user IS
  'Max redemptions allowed per customer (NULL = unlimited). Enforced via coupon_usages.';

-- ============================================================================
-- Customer password reset: auth_version + rate-limit event log + OTP index
-- ============================================================================
-- Safe to run multiple times (idempotent). Compatible with RDS Data API.
-- Date: 2026-04-22
-- ============================================================================

-- auth_version: bump on password set/change/reset; embedded in fallback JWTs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE customers ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE customers SET auth_version = 0 WHERE auth_version IS NULL;

COMMENT ON COLUMN customers.auth_version IS 'Increment on customer password set/change/reset; invalidates older fallback JWTs when >0 and claim mismatches.';

-- Append-only rate limit events (password reset OTP sends, optional verify throttles)
CREATE TABLE IF NOT EXISTS auth_operation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_key_scope_time
  ON auth_operation_rate_events (rate_key, operation_scope, created_at DESC);

COMMENT ON TABLE auth_operation_rate_events IS 'Append-only events for auth rate limits (e.g. customer password reset OTP sends).';

CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose_unused
  ON otp_tokens (phone, purpose)
  WHERE is_used = false;

-- ============================================================================
-- RDS Data API runbook (placeholders — do not put real secrets in git)
-- ============================================================================
-- Dev:
--   aws rds-data execute-statement \
--     --resource-arn "arn:aws:rds:REGION:ACCOUNT:cluster:DEV_CLUSTER_ID" \
--     --secret-arn "arn:aws:secretsmanager:REGION:ACCOUNT:secret:DEV_DB_SECRET_ID" \
--     --database "YOUR_DEV_DB_NAME" \
--     --sql "$(cat db/migrations/727_customer_password_reset_auth_version.sql)"
--
-- Prod:
--   aws rds-data execute-statement \
--     --resource-arn "arn:aws:rds:REGION:ACCOUNT:cluster:PROD_CLUSTER_ID" \
--     --secret-arn "arn:aws:secretsmanager:REGION:ACCOUNT:secret:PROD_DB_SECRET_ID" \
--     --database "YOUR_PROD_DB_NAME" \
--     --sql "$(cat db/migrations/727_customer_password_reset_auth_version.sql)"
--
-- If the statement exceeds Data API size limits, split on statement boundaries
-- (DO blocks, CREATE TABLE, CREATE INDEX) into multiple execute-statement calls.

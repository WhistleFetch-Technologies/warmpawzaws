#!/usr/bin/env bash
# RDS Data API: apply 727 (customer auth_version + auth_operation_rate_events + OTP index)
# and 728 (vendors password_hash + auth_version). Idempotent. Same pattern as run-migration-724-cloudshell.sh.
#
# Usage: ./scripts/run-migration-727-728-cloudshell.sh dev
#        ./scripts/run-migration-727-728-cloudshell.sh prod
#        both: ./scripts/run-migration-727-728-cloudshell.sh dev && ./scripts/run-migration-727-728-cloudshell.sh prod
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ENV="${1:?usage: $0 dev|prod}"
CLUSTER_ID="warmpawz-${ENV}-cluster"
DB_NAME="${DB_NAME:-warmpawz}"

echo "Region=$REGION Cluster=$CLUSTER_ID Database=$DB_NAME"

CLUSTER_ARN=$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --region "$REGION" \
  --query 'DBClusters[0].DBClusterArn' --output text)
SECRET_ARN=$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --region "$REGION" \
  --query 'DBClusters[0].MasterUserSecret.SecretArn' --output text)

if [[ "$SECRET_ARN" == "None" || -z "$SECRET_ARN" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    SECRET_NAME="warmpawz-prod-rds-master-20260207201049162400000001"
  else
    SECRET_NAME="warmpawz-dev-rds-master-20260106164510791100000002"
  fi
  SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" --query 'ARN' --output text)
fi

run_sql() {
  echo "--- execute-statement ($(echo "$1" | head -c 80))..."
  aws rds-data execute-statement \
    --resource-arn "$CLUSTER_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DB_NAME" \
    --region "$REGION" \
    --sql "$1"
}

# --- 727_customer_password_reset_auth_version.sql (one statement per Data API call) ---
run_sql "$(cat <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE customers ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
SQL
)"

run_sql "UPDATE customers SET auth_version = 0 WHERE auth_version IS NULL"

run_sql "COMMENT ON COLUMN customers.auth_version IS 'Increment on customer password set/change/reset; invalidates older fallback JWTs when >0 and claim mismatches.'"

run_sql "$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS auth_operation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
SQL
)"

run_sql "CREATE INDEX IF NOT EXISTS idx_auth_rate_key_scope_time ON auth_operation_rate_events (rate_key, operation_scope, created_at DESC)"

run_sql "COMMENT ON TABLE auth_operation_rate_events IS 'Append-only events for auth rate limits (e.g. customer password reset OTP sends).'"

run_sql "CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose_unused ON otp_tokens (phone, purpose) WHERE is_used = false"

# --- 728_vendor_password_hash_auth_version.sql ---
run_sql "$(cat <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN password_hash TEXT;
    COMMENT ON COLUMN public.vendors.password_hash IS 'bcrypt ($2*) or legacy PBKDF2 salt:hex — mirrors customers.password_hash';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    UPDATE public.vendors SET auth_version = 0 WHERE auth_version IS NULL;
    COMMENT ON COLUMN public.vendors.auth_version IS 'Bump on vendor password set/change; reserved for JWT invalidation parity with customers.';
  END IF;
END $$;
SQL
)"

echo "Verify:"
aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --region "$REGION" \
  --sql "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name IN ('auth_version','password_hash') ORDER BY column_name"
aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --region "$REGION" \
  --sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_operation_rate_events'"

echo "OK: migrations 727 + 728 on $ENV"

#!/usr/bin/env bash
# RDS Data API: apply 731_admin_ai_audit.sql (admin_ai_audit table + indexes). Idempotent.
#
# Prerequisites: AWS CLI v2, profile/role with rds-data:ExecuteStatement, rds:DescribeDBClusters,
#   secretsmanager:DescribeSecret on the cluster master secret.
#
# Usage (from repo root, or any path — script resolves SQL relative to repo via SCRIPT_DIR):
#   bash scripts/run-migration-731-admin-ai-audit-cloudshell.sh dev
#   bash scripts/run-migration-731-admin-ai-audit-cloudshell.sh prod
#   both:
#   bash scripts/run-migration-731-admin-ai-audit-cloudshell.sh dev && bash scripts/run-migration-731-admin-ai-audit-cloudshell.sh prod
#
# In AWS CloudShell: clone repo or paste SQL; set REGION if not ap-south-1.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ENV="${1:?usage: $0 dev|prod}"
CLUSTER_ID="warmpawz-${ENV}-cluster"
DB_NAME="${DB_NAME:-warmpawz}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="${REPO_ROOT}/db/migrations/731_admin_ai_audit.sql"

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

if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERROR: SQL file not found: $SQL_FILE" >&2
  exit 1
fi

# RDS Data API: one statement per call (split migration file).
run_sql "$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS admin_ai_audit (
  id UUID PRIMARY KEY,
  admin_principal_id TEXT NOT NULL,
  route TEXT NOT NULL,
  tool_names TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER,
  outcome TEXT NOT NULL,
  prompt_hash TEXT,
  message_len INTEGER
)
SQL
)"

run_sql "CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_created_at ON admin_ai_audit (created_at DESC)"

run_sql "CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_principal ON admin_ai_audit (admin_principal_id)"

echo "Verify ($ENV):"
aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --region "$REGION" \
  --sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_ai_audit' ORDER BY ordinal_position"

echo "OK: migration 731 (admin_ai_audit) on $ENV"

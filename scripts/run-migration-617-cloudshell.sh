#!/usr/bin/env bash
# Run inside AWS CloudShell (has AWS CLI + credentials). Region: change if needed.
set -euo pipefail
REGION="${AWS_REGION:-ap-south-1}"
ENV="${1:-dev}"
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

if [[ -z "$SECRET_ARN" || "$SECRET_ARN" == "None" ]]; then
  echo "Could not resolve secret ARN. Enable Data API on the cluster and ensure Secrets Manager has the master secret."
  exit 1
fi

run_sql() {
  aws rds-data execute-statement \
    --resource-arn "$CLUSTER_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DB_NAME" \
    --region "$REGION" \
    --sql "$1"
}

run_sql "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb"
run_sql "COMMENT ON COLUMN support_tickets.attachments IS 'Optional attachment URLs or metadata (JSON array)'"

echo "Verify:"
aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --region "$REGION" \
  --sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'attachments'"

echo "Done."

#!/usr/bin/env bash
# Run in AWS CloudShell or any host with AWS CLI + rds-data:ExecuteStatement on the cluster secret.
# Usage: ./run-migration-724-cloudshell.sh dev
#        ./run-migration-724-cloudshell.sh prod
#        for both:  ./run-migration-724-cloudshell.sh dev && ./run-migration-724-cloudshell.sh prod
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
  aws rds-data execute-statement \
    --resource-arn "$CLUSTER_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DB_NAME" \
    --region "$REGION" \
    --sql "$1"
}

run_sql "$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS public.ai_booking_wizard_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,
    category TEXT NOT NULL DEFAULT 'vet',
    vendor_id UUID,
    vendor_service_id UUID,
    service_style TEXT,
    booking_date TEXT,
    slot_time TEXT,
    total_duration INTEGER NOT NULL DEFAULT 30,
    staff_id TEXT,
    pet_id UUID,
    address_id UUID,
    slots_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready_for_booking', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
SQL
)"

run_sql "CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_customer ON public.ai_booking_wizard_sessions (customer_id)"
run_sql "CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_phone ON public.ai_booking_wizard_sessions (customer_phone)"
run_sql "CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_expires ON public.ai_booking_wizard_sessions (expires_at)"
run_sql "COMMENT ON TABLE public.ai_booking_wizard_sessions IS 'Server-backed booking draft for in-chat wizard; slots_snapshot is JSON from available-slots for commit validation when self-HTTP is unavailable'"

echo "Verify:"
aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --region "$REGION" \
  --sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_booking_wizard_sessions'"

echo "OK: migration 724 on $ENV"

#!/bin/bash
# ============================================================================
# Verify and Fix Missing Tables Script
# ============================================================================
# Checks for missing tables and provides fix instructions
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔍 Verifying Database Tables"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get database credentials
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ]; then
  echo "❌ ERROR: RDS cluster not found"
  exit 1
fi

RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
  --output text | head -1)

if [ -z "$RDS_SECRET_ARN" ]; then
  echo "❌ ERROR: RDS secret not found"
  exit 1
fi

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:5432/warmpawz"

echo "✅ Database connection configured"
echo ""

# Check critical tables
CRITICAL_TABLES=(
  "customer_wallets"
  "wallet_transactions"
  "booking_cancellation_rules"
  "refund_rules"
  "service_categories"
)

echo "📊 Checking critical tables..."
echo ""

MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
  EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null || echo "f")
  
  if [ "$EXISTS" = "t" ]; then
    echo "  ✅ $table - EXISTS"
  else
    echo "  ❌ $table - MISSING"
    MISSING_TABLES+=("$table")
  fi
done

echo ""

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
  echo "✅ All critical tables exist!"
else
  echo "⚠️  Missing tables found: ${MISSING_TABLES[*]}"
  echo ""
  echo "🔧 Fix Instructions:"
  echo ""
  
  for table in "${MISSING_TABLES[@]}"; do
    case $table in
      "customer_wallets"|"wallet_transactions")
        echo "  $table: Run migration 012_wallet_tables.sql"
        echo "    cd db && node run-migration.js migrations/012_wallet_tables.sql"
        ;;
      "booking_cancellation_rules"|"refund_rules")
        echo "  $table: Run migration 060_create_refund_rules_tables.sql"
        echo "    cd db && node run-migration.js migrations/060_create_refund_rules_tables.sql"
        ;;
      "service_categories")
        echo "  $table: Table should exist from migration 001. Check schema."
        ;;
    esac
    echo ""
  done
fi

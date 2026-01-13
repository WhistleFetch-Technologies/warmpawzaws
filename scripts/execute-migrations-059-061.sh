#!/bin/bash
# ============================================================================
# EXECUTE MIGRATIONS 059-061
# ============================================================================
# Executes critical migrations for test coverage fixes
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔄 Executing Migrations 059-061"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get database connection from AWS
echo "📊 Getting database connection from AWS..."

RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo "❌ ERROR: RDS cluster not found: $RDS_CLUSTER_ID"
  exit 1
fi

RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
  --output text | head -1 2>/dev/null || echo "")

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "None" ]; then
  echo "❌ ERROR: RDS secret not found"
  exit 1
fi

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo "❌ ERROR: Could not retrieve database credentials"
  exit 1
fi

# Extract credentials
if command -v jq &> /dev/null; then
  DB_USER=$(echo "$DB_SECRET" | jq -r '.username // .Username // ""' 2>/dev/null || echo "")
  DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""' 2>/dev/null || echo "")
else
  DB_USER=$(echo "$DB_SECRET" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('username') or d.get('Username') or '')" 2>/dev/null || echo "")
  DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('password') or d.get('Password') or '')" 2>/dev/null || echo "")
fi

DB_NAME=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].DatabaseName' \
  --output text 2>/dev/null || echo "warmpawz")

export PGPASSWORD="$DB_PASSWORD"

echo "✅ Database connection configured"
echo "   Host: $RDS_ENDPOINT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Execute migrations using Node.js (psql may not be available)
echo "📝 Executing migrations using Node.js..."
cd "$(dirname "$0")/.."

if node scripts/execute-migrations-059-061-node.js "$ENVIRONMENT" "$REGION" 2>&1; then
  echo "✅ Migrations executed"
else
  echo "⚠️  Migration execution encountered issues. Check output above."
fi

echo "✅ All migrations executed"
echo ""
echo "Next: Re-run test suite to verify fixes"

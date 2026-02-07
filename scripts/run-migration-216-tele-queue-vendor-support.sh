#!/bin/bash
# ============================================================================
# RUN MIGRATION 216: Support Solo Vendors in Tele Queue
# ============================================================================
# This migration adds vendor_id column and makes staff_id nullable in tele_queue
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"

echo "🚀 Running Migration 216: Tele Queue Vendor Support"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get RDS cluster info
CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
echo "📊 Getting RDS cluster information..."

CLUSTER_INFO=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --output json)

DB_NAME=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].DatabaseName // "warmpawz"')
SECRET_ARN=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].MasterUserSecret.SecretArn // ""')

if [ -z "$SECRET_ARN" ]; then
  # Fallback to known secret ARN pattern
  SECRET_ARN="arn:aws:secretsmanager:${REGION}:$(aws sts get-caller-identity --query Account --output text):secret:warmpawz-${ENVIRONMENT}-rds-master-*"
  SECRET_ARN=$(aws secretsmanager list-secrets --region "$REGION" \
    --filters "Key=name,Values=warmpawz-${ENVIRONMENT}-rds-master" \
    --query 'SecretList[0].ARN' --output text)
fi

echo "✅ Cluster found:"
echo "   Database: $DB_NAME"
echo "   Secret ARN: $SECRET_ARN"
echo ""

# Read migration file
MIGRATION_FILE="db/migrations/216_tele_queue_support_vendors.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Reading migration file: $MIGRATION_FILE"
MIGRATION_SQL=$(cat "$MIGRATION_FILE")

echo ""
echo "⚠️  WARNING: This will modify the tele_queue table structure."
echo "   - Add vendor_id column"
echo "   - Make staff_id nullable"
echo "   - Update indexes"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Migration cancelled."
  exit 0
fi

echo ""
echo "🔄 Running migration..."

# Use AWS RDS Data API or direct connection
# For now, we'll use psql if available, otherwise suggest using AWS Query Editor

if command -v psql &> /dev/null; then
  echo "Using psql..."
  
  # Get database credentials
  SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --region "$REGION" --output json)
  DB_USER=$(echo "$SECRET_VALUE" | jq -r '.SecretString | fromjson | .username // .user')
  DB_PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.SecretString | fromjson | .password')
  DB_HOST=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].Endpoint')
  DB_PORT=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].Port // 5432')
  
  export PGPASSWORD="$DB_PASSWORD"
  
  echo "$MIGRATION_SQL" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f -
  
  echo ""
  echo "✅ Migration completed successfully!"
  
  # Verify
  echo ""
  echo "🔍 Verifying migration..."
  VERIFY_SQL="SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tele_queue' AND column_name IN ('staff_id', 'vendor_id') ORDER BY column_name;"
  echo "$VERIFY_SQL" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
  
else
  echo ""
  echo "❌ psql not found. Please use one of these options:"
  echo ""
  echo "Option 1: Install psql (PostgreSQL client)"
  echo "   macOS: brew install postgresql"
  echo "   Ubuntu: sudo apt-get install postgresql-client"
  echo ""
  echo "Option 2: Use AWS RDS Query Editor"
  echo "   1. Go to AWS RDS Console"
  echo "   2. Select your cluster: $CLUSTER_ID"
  echo "   3. Click 'Query Editor'"
  echo "   4. Copy and paste the contents of: $MIGRATION_FILE"
  echo "   5. Execute the query"
  echo ""
  echo "Option 3: Use the Node.js migration runner"
  echo "   node scripts/run-migration-via-rds-data-api.js"
  echo ""
  exit 1
fi

echo ""
echo "✅ Migration 216 completed successfully!"
echo "   The tele_queue table now supports solo vendors."

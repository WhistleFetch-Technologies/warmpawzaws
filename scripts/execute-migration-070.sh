#!/bin/bash
# ============================================================================
# EXECUTE MIGRATION 070: Package Tracking Enhancements
# ============================================================================
# Executes migration 070_package_tracking_enhancements.sql
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔄 Executing Migration 070: Package Tracking Enhancements"
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
  echo "💡 Trying alternative: RDS instance..."
  RDS_INSTANCE_ID="warmpawz-${ENVIRONMENT}-db"
  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ]; then
    echo "❌ ERROR: RDS endpoint not found"
    exit 1
  fi
fi

echo "✅ RDS Endpoint: $RDS_ENDPOINT"

RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
  --output text | head -1 2>/dev/null || echo "")

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "None" ]; then
  echo "❌ ERROR: RDS secret not found"
  echo "💡 Please provide database credentials manually"
  exit 1
fi

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo "❌ ERROR: Could not retrieve database secret"
  exit 1
fi

DB_USER=$(echo "$DB_SECRET" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
DB_PASSWORD=$(echo "$DB_SECRET" | grep -o '"password":"[^"]*"' | cut -d'"' -f4)
DB_NAME=$(echo "$DB_SECRET" | grep -o '"dbname":"[^"]*"' | cut -d'"' -f4 || echo "warmpawz_${ENVIRONMENT}")

if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  echo "❌ ERROR: Could not parse database credentials"
  exit 1
fi

echo "✅ Database: $DB_NAME"
echo "✅ User: $DB_USER"
echo ""

# Check if migration file exists
MIGRATION_FILE="db/migrations/070_package_tracking_enhancements.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo ""

# Execute migration
echo "🚀 Executing migration..."
export PGPASSWORD="$DB_PASSWORD"

psql -h "$RDS_ENDPOINT" \
     -U "$DB_USER" \
     -d "$DB_NAME" \
     -f "$MIGRATION_FILE" \
     -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration 070 executed successfully!"
  echo ""
  echo "📊 Verifying tables created..."
  
  psql -h "$RDS_ENDPOINT" \
       -U "$DB_USER" \
       -d "$DB_NAME" \
       -c "SELECT table_name FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name IN (
             'package_purchases', 
             'package_scheduled_sessions',
             'walk_routes', 
             'walker_live_sessions',
             'training_skills', 
             'pet_skill_progress'
           ) 
           ORDER BY table_name;"
  
  echo ""
  echo "✅ Migration complete!"
else
  echo ""
  echo "❌ Migration failed!"
  exit 1
fi

unset PGPASSWORD

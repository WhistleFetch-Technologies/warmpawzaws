#!/bin/bash
# Run Migration 071: Vendor Settings Columns
# Adds service_radius, emergency_contact, max_dogs_per_walk, walk_durations, other_config to vendors table

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔄 Running Migration 071: Vendor Settings Columns"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get RDS endpoint
CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
echo "📡 Getting RDS endpoint for cluster: $CLUSTER_ID"

ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null)

if [ -z "$ENDPOINT" ] || [ "$ENDPOINT" == "None" ]; then
  echo "❌ Error: Could not get RDS endpoint. Check cluster name and AWS credentials."
  exit 1
fi

echo "✅ RDS Endpoint: $ENDPOINT"

# Get database credentials from Secrets Manager
SECRET_NAME="warmpawz-${ENVIRONMENT}-rds-master"
echo "🔐 Getting database credentials from: $SECRET_NAME"

SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, '${SECRET_NAME}')].ARN" \
  --output text | head -n1)

if [ -z "$SECRET_ARN" ]; then
  echo "❌ Error: Could not find secret. Check secret name and AWS credentials."
  exit 1
fi

SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

# Parse JSON - try jq first, fallback to Python
if command -v jq &> /dev/null; then
  DB_USER=$(echo "$SECRET_VALUE" | jq -r '.username // .Username // empty')
  DB_PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.password // .Password // empty')
  DB_NAME=$(echo "$SECRET_VALUE" | jq -r '.dbname // .database // "warmpawz_'${ENVIRONMENT}'"')
elif command -v python3 &> /dev/null; then
  DB_USER=$(echo "$SECRET_VALUE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('username') or d.get('Username') or '')")
  DB_PASSWORD=$(echo "$SECRET_VALUE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('password') or d.get('Password') or '')")
  DB_NAME=$(echo "$SECRET_VALUE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('dbname') or d.get('database') or 'warmpawz_${ENVIRONMENT}')")
else
  echo "❌ Error: Need either 'jq' or 'python3' to parse JSON. Install one:"
  echo "   brew install jq"
  echo "   or ensure python3 is available"
  exit 1
fi

if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  echo "❌ Error: Could not extract database credentials from secret."
  exit 1
fi

echo "✅ Database: $DB_NAME"
echo "✅ User: $DB_USER"
echo ""

# Set PGPASSWORD environment variable
export PGPASSWORD="$DB_PASSWORD"

# Run migration
MIGRATION_FILE="db/migrations/071_vendor_settings_columns.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Running migration from: $MIGRATION_FILE"
echo ""

psql -h "$ENDPOINT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$MIGRATION_FILE" \
  -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "🔍 Verifying columns were added..."
  
  # Verify columns exist
  psql -h "$ENDPOINT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'vendors'
    AND column_name IN ('service_radius', 'emergency_contact', 'max_dogs_per_walk', 'walk_durations', 'other_config')
    ORDER BY column_name;
    "
  
  echo ""
  echo "✅ Verification complete!"
else
  echo ""
  echo "❌ Migration failed. Check the error above."
  exit 1
fi

# Clear password from environment
unset PGPASSWORD

echo ""
echo "🎉 Migration 071 complete!"

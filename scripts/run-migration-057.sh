#!/bin/bash
# ============================================================================
# Run Migration 057: Vendor Capabilities Tables
# ============================================================================
# This script safely runs migration 057 after checking existing tables
# ============================================================================

set -e

REGION="ap-south-1"
RDS_ENDPOINT="warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com"
DB_NAME="warmpawz"
MIGRATION_FILE="db/migrations/057_vendor_capabilities_tables.sql"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "============================================================================"
echo "Migration 057: Vendor Capabilities Tables"
echo "============================================================================"
echo ""

# Get RDS secret ARN
echo "🔐 Getting RDS credentials from Secrets Manager..."
RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-dev-rds-master')].ARN" \
  --output text | head -1)

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "None" ] || [ "$RDS_SECRET_ARN" = "null" ]; then
  echo "❌ ERROR: RDS secret not found"
  exit 1
fi

echo "✅ Secret found: $RDS_SECRET_ARN"

# Get credentials
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo "❌ ERROR: Failed to retrieve secret from Secrets Manager"
  exit 1
fi

# Parse credentials
if command -v jq &> /dev/null; then
  DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
  DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')
else
  DB_USERNAME=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('username') or data.get('Username') or 'warmpawz_admin')" <<< "$DB_SECRET")
  DB_PASSWORD=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('password') or data.get('Password') or '')" <<< "$DB_SECRET")
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo "❌ ERROR: Password not found in secret"
  exit 1
fi

echo "✅ Credentials retrieved"
echo "   Username: $DB_USERNAME"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Database: $DB_NAME"
echo ""

# Check existing tables
echo "🔍 Checking existing tables..."
export PGPASSWORD="$DB_PASSWORD"

EXISTING_TABLES=$(psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'prescriptions', 'medical_records', 'diagnostic_tests',
  'service_packages', 'package_sessions', 'gps_tracking_sessions',
  'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
  'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
)
ORDER BY table_name;
" 2>&1 | grep -v "^$" | tr -d ' ')

if [ -n "$EXISTING_TABLES" ]; then
  echo -e "${YELLOW}⚠️  WARNING: The following tables already exist:${NC}"
  echo "$EXISTING_TABLES" | while read -r table; do
    echo "   - $table"
  done
  echo ""
  echo -e "${YELLOW}The migration uses 'CREATE TABLE IF NOT EXISTS' so it's safe to run.${NC}"
  echo ""
fi

# Confirm before running
read -p "Do you want to proceed with the migration? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo "🚀 Running migration..."
echo ""

# Run migration
psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$MIGRATION_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  echo ""
  
  # Verify tables created
  echo "🔍 Verifying tables..."
  psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$DB_NAME" -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN (
    'prescriptions', 'medical_records', 'diagnostic_tests',
    'service_packages', 'package_sessions', 'gps_tracking_sessions',
    'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
    'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
  )
  ORDER BY table_name;
  " 2>&1
  
  echo ""
  echo -e "${GREEN}✅ Migration 057 complete!${NC}"
else
  echo ""
  echo -e "${RED}❌ Migration failed!${NC}"
  exit 1
fi

#!/bin/bash
# ============================================================================
# Run Migration 059: Customer State Management
# ============================================================================
# This script safely runs migration 059 to add customer state management
# ============================================================================

set -e

REGION="${AWS_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
MIGRATION_FILE="db/migrations/059_customer_state_management.sql"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "============================================================================"
echo "Migration 059: Customer State Management"
echo "============================================================================"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ ERROR: Migration file not found: ${MIGRATION_FILE}${NC}"
  exit 1
fi

echo -e "${BLUE}📁 Migration file: ${MIGRATION_FILE}${NC}"
echo ""

# Get RDS endpoint
echo -e "${BLUE}Step 1: Getting RDS cluster information...${NC}"
echo ""

# Try to get from environment or use default
RDS_ENDPOINT="${RDS_ENDPOINT:-warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com}"
DB_NAME="${DB_NAME:-warmpawz}"

# Try to get from AWS if not set
if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo "   Getting RDS endpoint from AWS..."
  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --region "$REGION" \
    --query "DBInstances[?contains(DBInstanceIdentifier, 'warmpawz')].Endpoint.Address" \
    --output text 2>/dev/null | head -1 || echo "")
fi

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${YELLOW}⚠️  RDS endpoint not found via AWS. Using environment variables or manual input.${NC}"
  echo ""
  read -p "Enter RDS endpoint: " RDS_ENDPOINT
  read -p "Enter database name [warmpawz]: " DB_NAME
  DB_NAME="${DB_NAME:-warmpawz}"
fi

echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Database: ${DB_NAME}"
echo "   Region: ${REGION}"
echo ""

# Get credentials
echo -e "${BLUE}Step 2: Getting database credentials...${NC}"
echo ""

# Try to get secret ARN
RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master') || starts_with(Name, 'warmpawz-dev-rds-master')].ARN" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "None" ] || [ "$RDS_SECRET_ARN" = "null" ]; then
  echo -e "${YELLOW}⚠️  Secret not found in Secrets Manager.${NC}"
  echo ""
  read -p "Enter database username: " DB_USERNAME
  read -s -p "Enter database password: " DB_PASSWORD
  echo ""
else
  echo "✅ Secret found: $RDS_SECRET_ARN"
  
  DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ARN" \
    --region "$REGION" \
    --query SecretString \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$DB_SECRET" ]; then
    echo -e "${RED}❌ ERROR: Failed to retrieve secret${NC}"
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
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo -e "${RED}❌ ERROR: Password not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Credentials retrieved${NC}"
echo "   Username: $DB_USERNAME"
echo ""

# Test connection
echo -e "${BLUE}Step 3: Testing database connection...${NC}"
echo ""

export PGHOST="$RDS_ENDPOINT"
export PGPORT="${RDS_PORT:-5432}"
export PGDATABASE="$DB_NAME"
export PGUSER="$DB_USERNAME"
export PGPASSWORD="$DB_PASSWORD"

if psql -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Database connection successful${NC}"
else
  echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
  echo "   Check:"
  echo "   1. RDS is accessible from your IP"
  echo "   2. Security group allows connections"
  echo "   3. Credentials are correct"
  exit 1
fi

echo ""

# Check existing columns/tables
echo -e "${BLUE}Step 4: Checking existing schema...${NC}"
echo ""

EXISTING_COLUMNS=$(psql -t -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('status', 'onboarding_status', 'profile_completed', 'customer_identity_id')
ORDER BY column_name;
" 2>&1 | grep -v "^$" | tr -d ' ' || echo "")

EXISTING_TABLES=$(psql -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('customer_identity', 'customer_profile_completion')
ORDER BY table_name;
" 2>&1 | grep -v "^$" | tr -d ' ' || echo "")

if [ -n "$EXISTING_COLUMNS" ] || [ -n "$EXISTING_TABLES" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Some schema elements already exist:${NC}"
  if [ -n "$EXISTING_COLUMNS" ]; then
    echo "   Existing columns in customers table:"
    echo "$EXISTING_COLUMNS" | while read -r col; do
      echo "      - $col"
    done
  fi
  if [ -n "$EXISTING_TABLES" ]; then
    echo "   Existing tables:"
    echo "$EXISTING_TABLES" | while read -r table; do
      echo "      - $table"
    done
  fi
  echo ""
  echo -e "${YELLOW}The migration uses 'IF NOT EXISTS' so it's safe to run.${NC}"
  echo ""
fi

# Confirm before running
echo -e "${BLUE}Step 5: Ready to run migration${NC}"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 6: Running migration...${NC}"
echo "─────────────────────────────────────────────────────────────────────────"

# Run migration
psql -f "$MIGRATION_FILE" 2>&1 | tee /tmp/migration-059-output.log

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  echo ""
  
  # Verify migration
  echo -e "${BLUE}Step 7: Verifying migration...${NC}"
  echo ""
  
  VERIFICATION=$(psql -t -c "
  SELECT 
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'status'
    ) THEN '✅ customers.status' ELSE '❌ customers.status' END ||
    ' | ' ||
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'onboarding_status'
    ) THEN '✅ customers.onboarding_status' ELSE '❌ customers.onboarding_status' END ||
    ' | ' ||
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'customer_identity'
    ) THEN '✅ customer_identity' ELSE '❌ customer_identity' END ||
    ' | ' ||
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'customer_profile_completion'
    ) THEN '✅ customer_profile_completion' ELSE '❌ customer_profile_completion' END
  " 2>&1 | tr -d ' ')
  
  echo "$VERIFICATION"
  echo ""
  
  # Show sample data
  echo -e "${BLUE}Sample customer states:${NC}"
  psql -c "
  SELECT 
    phone,
    status,
    onboarding_status,
    profile_completed
  FROM customers
  LIMIT 5;
  " 2>&1 || echo "   (No customers found or error)"
  
  echo ""
  echo -e "${GREEN}✅ Migration 059 completed and verified!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Deploy backend changes"
  echo "  2. Test customer authentication"
  echo "  3. Verify state transitions"
  
else
  echo ""
  echo -e "${RED}❌ Migration failed with exit code: $MIGRATION_EXIT_CODE${NC}"
  echo ""
  echo "Check the error above or review: /tmp/migration-059-output.log"
  exit 1
fi

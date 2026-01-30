#!/bin/bash
#
# Apply Migration 401: Fix Booking Slot Unique Indexes
# =====================================================
# This migration fixes the unique indexes to only block 'confirmed' bookings
#
# Usage:
#   ./scripts/apply-migration-401.sh [environment]
#
# Examples:
#   ./scripts/apply-migration-401.sh dev
#   ./scripts/apply-migration-401.sh stage
#   ./scripts/apply-migration-401.sh prod
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/db/migrations/401_fix_booking_slot_unique_indexes.sql"

echo "================================================================="
echo "🔧 Apply Migration 401: Fix Booking Slot Unique Indexes"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Migration File: ${MIGRATION_FILE}"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ ERROR: Migration file not found: ${MIGRATION_FILE}${NC}"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ ERROR: Node.js not found${NC}"
  echo "   Install: https://nodejs.org/"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo -e "${BLUE}Using DATABASE_URL from environment${NC}"
  echo "   Format: ${DATABASE_URL//:[^:@]*@/:***@}"
  echo ""
  
  echo -e "${BLUE}Running migration...${NC}"
  cd "$PROJECT_ROOT"
  export DATABASE_URL
  node db/run-migration.js "db/migrations/401_fix_booking_slot_unique_indexes.sql"
  
  echo ""
  echo -e "${GREEN}✅ Migration 401 applied successfully!${NC}"
  exit 0
fi

# If DATABASE_URL not set, try to get from Terraform/AWS
echo -e "${YELLOW}DATABASE_URL not set. Attempting to get from Terraform/AWS...${NC}"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ ERROR: AWS CLI not found${NC}"
  echo "   Install: https://aws.amazon.com/cli/"
  echo ""
  echo -e "${YELLOW}Alternative: Set DATABASE_URL environment variable${NC}"
  echo "   export DATABASE_URL='postgresql://user:password@host:5432/database'"
  exit 1
fi

# Check Terraform
if ! command -v terraform &> /dev/null; then
  echo -e "${RED}❌ ERROR: Terraform not found${NC}"
  echo "   Install: https://www.terraform.io/downloads"
  echo ""
  echo -e "${YELLOW}Alternative: Set DATABASE_URL environment variable${NC}"
  echo "   export DATABASE_URL='postgresql://user:password@host:5432/database'"
  exit 1
fi

echo -e "${BLUE}Step 1: Retrieving database credentials from Terraform...${NC}"
echo ""

cd "$PROJECT_ROOT/infra/envs/${ENVIRONMENT}"

# Initialize Terraform
terraform init -backend-config=backend.hcl > /dev/null 2>&1

# Get Terraform outputs
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
RDS_SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
RDS_DB_NAME=$(terraform output -raw rds_database_name 2>/dev/null || echo "")
RDS_PORT=$(terraform output -raw rds_port 2>/dev/null || echo "5432")
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "ap-south-1")

# Validate outputs
if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS endpoint not found in Terraform outputs${NC}"
  echo "   Run Terraform apply first, or set DATABASE_URL manually"
  exit 1
fi

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS secret ARN not found in Terraform outputs${NC}"
  echo "   Set DATABASE_URL manually"
  exit 1
fi

echo -e "${GREEN}✅ Terraform outputs retrieved${NC}"
echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Database: ${RDS_DB_NAME}"
echo ""

echo -e "${BLUE}Step 2: Fetching credentials from AWS Secrets Manager...${NC}"
echo ""

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo -e "${RED}❌ ERROR: Failed to fetch database credentials${NC}"
  echo "   Set DATABASE_URL manually"
  exit 1
fi

DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('password',''))")
DB_USERNAME=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username','postgres'))")

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo -e "${RED}❌ ERROR: Database password not found in secret${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Credentials retrieved${NC}"
echo "   Username: ${DB_USERNAME}"
echo ""

echo -e "${BLUE}Step 3: Constructing DATABASE_URL...${NC}"
echo ""

DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:${RDS_PORT}/${RDS_DB_NAME}"

echo -e "${GREEN}✅ DATABASE_URL constructed${NC}"
echo ""

echo -e "${BLUE}Step 4: Running migration...${NC}"
echo ""

cd "$PROJECT_ROOT"
export DATABASE_URL
node db/run-migration.js "db/migrations/401_fix_booking_slot_unique_indexes.sql"

echo ""
echo -e "${GREEN}✅ Migration 401 applied successfully!${NC}"
echo ""
echo -e "${BLUE}Verification:${NC}"
echo "   Run the test suite to verify:"
echo "   cd backend/lambda && ./run-all-tests.sh"

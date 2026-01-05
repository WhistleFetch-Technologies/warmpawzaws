#!/bin/bash
#
# Manual Database Migration Script
# =================================
# Run this script AFTER deployment completes successfully
#
# Usage:
#   ./scripts/manual-migrate.sh [environment]
#
# Examples:
#   ./scripts/manual-migrate.sh dev
#   ./scripts/manual-migrate.sh stage
#   ./scripts/manual-migrate.sh prod
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

echo "================================================================="
echo "🗄️  Manual Database Migration Runner"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Project Root: ${PROJECT_ROOT}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|stage|prod)$ ]]; then
  echo -e "${RED}❌ ERROR: Invalid environment '${ENVIRONMENT}'${NC}"
  echo "   Valid options: dev, stage, prod"
  exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ ERROR: AWS CLI not found${NC}"
  echo "   Install: https://aws.amazon.com/cli/"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ ERROR: Node.js not found${NC}"
  echo "   Install: https://nodejs.org/"
  exit 1
fi

# Check Terraform
if ! command -v terraform &> /dev/null; then
  echo -e "${RED}❌ ERROR: Terraform not found${NC}"
  echo "   Install: https://www.terraform.io/downloads"
  exit 1
fi

echo -e "${BLUE}Step 1: Retrieving database credentials...${NC}"
echo ""

cd "$PROJECT_ROOT/infra/envs/${ENVIRONMENT}"

# Initialize Terraform
terraform init -backend-config=backend.hcl > /dev/null

# Get Terraform outputs
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
RDS_SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
RDS_DB_NAME=$(terraform output -raw rds_database_name 2>/dev/null || echo "")
RDS_PORT=$(terraform output -raw rds_port 2>/dev/null || echo "5432")
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "ap-south-1")

# Validate outputs
if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS endpoint not found in Terraform outputs${NC}"
  echo "   Run Terraform apply first"
  exit 1
fi

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS secret ARN not found in Terraform outputs${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Terraform outputs retrieved${NC}"
echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Database: ${RDS_DB_NAME}"
echo "   Port: ${RDS_PORT}"
echo "   Region: ${AWS_REGION}"
echo ""

echo -e "${BLUE}Step 2: Fetching credentials from Secrets Manager...${NC}"
echo ""

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo -e "${RED}❌ ERROR: Failed to retrieve secret from Secrets Manager${NC}"
  echo "   Secret ARN: ${RDS_SECRET_ARN}"
  exit 1
fi

DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('password',''))")
DB_USERNAME=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username','postgres'))")

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo -e "${RED}❌ ERROR: Failed to parse password from secret${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Credentials retrieved${NC}"
echo "   Username: ${DB_USERNAME}"
echo ""

echo -e "${BLUE}Step 3: Constructing DATABASE_URL...${NC}"
echo ""

# URL-encode password (for special characters)
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")

# Construct DATABASE_URL WITHOUT ?sslmode=require
# The migration script handles SSL automatically
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:${RDS_PORT}/${RDS_DB_NAME}"

echo -e "${GREEN}✅ DATABASE_URL constructed${NC}"
echo "   Format: postgresql://${DB_USERNAME}:***@${RDS_ENDPOINT}:${RDS_PORT}/${RDS_DB_NAME}"
echo "   SSL: Handled automatically by migration script"
echo ""

echo -e "${BLUE}Step 4: Testing database connectivity...${NC}"
echo ""

# Test TCP connection
if timeout 10 bash -c "cat < /dev/null > /dev/tcp/${RDS_ENDPOINT}/${RDS_PORT}" 2>/dev/null; then
  echo -e "${GREEN}✅ TCP connection successful${NC}"
else
  echo -e "${RED}❌ ERROR: Cannot connect to ${RDS_ENDPOINT}:${RDS_PORT}${NC}"
  echo ""
  echo "   Possible causes:"
  echo "   1. RDS is not publicly accessible"
  echo "   2. Security group blocks your IP"
  echo "   3. RDS is still initializing"
  echo ""
  echo "   For dev environment, run:"
  echo "   ./scripts/enable-rds-public-access-dev.sh"
  echo ""
  exit 1
fi

echo ""

echo -e "${BLUE}Step 5: Installing dependencies...${NC}"
echo ""

cd "$PROJECT_ROOT/db"

if [ ! -d "node_modules" ]; then
  npm ci
else
  echo "Dependencies already installed"
fi

echo ""

echo -e "${BLUE}Step 6: Running database migrations...${NC}"
echo ""

export DATABASE_URL="$DATABASE_URL"
export ENVIRONMENT="$ENVIRONMENT"

node run-migration-all.js

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Migrations failed with exit code: ${MIGRATION_EXIT_CODE}${NC}"
  exit $MIGRATION_EXIT_CODE
fi

echo ""
echo "================================================================="
echo -e "${GREEN}✅ Database migrations completed successfully!${NC}"
echo "================================================================="
echo ""
echo "Next steps:"
echo "  1. Verify migrations: cd db && npm run migrate:status"
echo "  2. Seed data: cd db && npm run seed:${ENVIRONMENT}"
echo "  3. Test API: curl https://${ENVIRONMENT}.api.warmpawz.com/health"
echo ""


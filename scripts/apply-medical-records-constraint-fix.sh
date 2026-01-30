#!/bin/bash
#
# Apply Migration 401: Fix medical_records record_type constraint
# ===============================================================
# This migration updates the check constraint to include 'prescription'
#
# Usage:
#   ./scripts/apply-medical-records-constraint-fix.sh [environment]
#
# Examples:
#   ./scripts/apply-medical-records-constraint-fix.sh dev
#   ./scripts/apply-medical-records-constraint-fix.sh stage
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
MIGRATION_FILE="$PROJECT_ROOT/db/migrations/401_fix_medical_records_record_type_constraint.sql"

echo "================================================================="
echo "🔧 Apply Migration 401: Fix Medical Records Constraint"
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
  node db/run-migration.js "db/migrations/401_fix_medical_records_record_type_constraint.sql"
  
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

echo -e "${BLUE}Step 1: Getting RDS cluster information...${NC}"
echo ""

REGION="ap-south-1"
CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"

RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS cluster not found: ${CLUSTER_ID}${NC}"
  echo "   Set DATABASE_URL manually"
  exit 1
fi

RDS_PORT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Port' \
  --output text 2>/dev/null || echo "5432")

RDS_DB_NAME=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].DatabaseName' \
  --output text 2>/dev/null || echo "warmpawz")

RDS_USERNAME=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].MasterUsername' \
  --output text 2>/dev/null || echo "warmpawz_admin")

echo -e "${GREEN}✅ RDS Cluster found${NC}"
echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Database: ${RDS_DB_NAME}"
echo "   Username: ${RDS_USERNAME}"
echo ""

echo -e "${BLUE}Step 2: Fetching credentials from AWS Secrets Manager...${NC}"
echo ""

# Try to find the RDS secret
SECRET_NAME="warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002"

# Verify secret exists
if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
  # Try to find any secret with rds-master
  SECRET_NAME=$(aws secretsmanager list-secrets \
    --region "$REGION" \
    --query "SecretList[?contains(Name, 'rds-master') && contains(Name, '${ENVIRONMENT}')].Name" \
    --output text | head -1)
fi

if [ -z "$SECRET_NAME" ] || [ "$SECRET_NAME" = "None" ]; then
  echo -e "${RED}❌ ERROR: RDS secret not found${NC}"
  echo "   Set DATABASE_URL manually"
  exit 1
fi

echo -e "${GREEN}✅ Found secret: ${SECRET_NAME}${NC}"
echo ""

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo -e "${RED}❌ ERROR: Failed to fetch database credentials${NC}"
  echo "   Set DATABASE_URL manually"
  exit 1
fi

DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('password',''))" 2>/dev/null || echo "")
DB_USERNAME=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username','postgres'))" 2>/dev/null || echo "warmpawz_admin")

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
node db/run-migration.js "db/migrations/401_fix_medical_records_record_type_constraint.sql"

echo ""
echo -e "${GREEN}✅ Migration 401 applied successfully!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "   1. Test prescription upload: POST /medical-records/booking/{bookingId}/upload-prescription"
echo "   2. Test prescription retrieval: GET /medical-records/booking/{bookingId}/prescriptions"
echo "   3. Verify constraint allows 'prescription' type"
echo ""

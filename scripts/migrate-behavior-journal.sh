#!/bin/bash
# ============================================================================
# Migrate Behavior Journal Table to AWS RDS
# ============================================================================
# Runs migration 055 to create behavior_journal table
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================="
echo "🗄️  Behavior Journal Table Migration"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ ERROR: AWS CLI not found${NC}"
  exit 1
fi

# Check psql
if ! command -v psql &> /dev/null; then
  echo -e "${RED}❌ ERROR: psql (PostgreSQL client) not found${NC}"
  echo "   Install: brew install postgresql (macOS) or apt-get install postgresql-client (Linux)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}Step 1: Getting RDS cluster information...${NC}"
echo ""

# Get RDS cluster info
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"

RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${YELLOW}⚠️  RDS cluster not found, trying Terraform outputs...${NC}"
  
  cd "$PROJECT_ROOT/infra/envs/${ENVIRONMENT}" 2>/dev/null || {
    echo -e "${RED}❌ ERROR: Cannot find RDS cluster or Terraform config${NC}"
    exit 1
  }
  
  terraform init -backend-config=backend.hcl > /dev/null 2>&1
  RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
  RDS_SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
  RDS_DB_NAME=$(terraform output -raw rds_database_name 2>/dev/null || echo "warmpawz")
  RDS_PORT=$(terraform output -raw rds_port 2>/dev/null || echo "5432")
  AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "$REGION")
else
  RDS_PORT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$RDS_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].Port' \
    --output text 2>/dev/null || echo "5432")
  
  RDS_DB_NAME=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$RDS_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].DatabaseName' \
    --output text 2>/dev/null || echo "warmpawz")
  
  RDS_USERNAME=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$RDS_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].MasterUsername' \
    --output text 2>/dev/null || echo "warmpawz_admin")
  
  # Try to find secret
  RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
    --region "$REGION" \
    --query "SecretList[?contains(Name, 'rds-master') || contains(Name, '${ENVIRONMENT}')].Arn" \
    --output text | head -1 || echo "")
  
  AWS_REGION="$REGION"
fi

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${RED}❌ ERROR: Could not determine RDS endpoint${NC}"
  exit 1
fi

echo -e "${GREEN}✅ RDS Information:${NC}"
echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Port: ${RDS_PORT}"
echo "   Database: ${RDS_DB_NAME}"
echo "   Region: ${AWS_REGION}"
echo ""

echo -e "${BLUE}Step 2: Getting database credentials...${NC}"
echo ""

if [ -n "$RDS_SECRET_ARN" ] && [ "$RDS_SECRET_ARN" != "null" ]; then
  DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ARN" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$DB_SECRET" ]; then
    DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('password',''))" 2>/dev/null || echo "")
    DB_USERNAME=$(echo "$DB_SECRET" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username','postgres'))" 2>/dev/null || echo "postgres")
  fi
fi

if [ -z "$DB_USERNAME" ]; then
  DB_USERNAME="${RDS_USERNAME:-postgres}"
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo -e "${YELLOW}⚠️  Password not found in secret, please enter manually:${NC}"
  read -s DB_PASSWORD
  echo ""
fi

echo -e "${GREEN}✅ Credentials retrieved${NC}"
echo "   Username: ${DB_USERNAME}"
echo ""

echo -e "${BLUE}Step 3: Testing database connection...${NC}"
echo ""

# Test connection
export PGHOST="$RDS_ENDPOINT"
export PGPORT="$RDS_PORT"
export PGDATABASE="$RDS_DB_NAME"
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
echo -e "${BLUE}Step 4: Running migration...${NC}"
echo ""

MIGRATION_FILE="$PROJECT_ROOT/db/migrations/055_behavior_journal_table.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ ERROR: Migration file not found: ${MIGRATION_FILE}${NC}"
  exit 1
fi

# Run migration
psql -f "$MIGRATION_FILE"

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Migration failed with exit code: ${MIGRATION_EXIT_CODE}${NC}"
  exit $MIGRATION_EXIT_CODE
fi

echo ""
echo -e "${BLUE}Step 5: Verifying table creation...${NC}"
echo ""

# Verify table exists
TABLE_EXISTS=$(psql -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'behavior_journal');" | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
  echo -e "${GREEN}✅ behavior_journal table created successfully${NC}"
  
  # Get table info
  TABLE_INFO=$(psql -c "\d behavior_journal" 2>/dev/null || echo "")
  if [ -n "$TABLE_INFO" ]; then
    echo ""
    echo "Table structure:"
    echo "$TABLE_INFO" | head -20
  fi
  
  # Count indexes
  INDEX_COUNT=$(psql -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'behavior_journal';" | xargs)
  echo ""
  echo -e "${GREEN}✅ Indexes created: ${INDEX_COUNT}${NC}"
else
  echo -e "${RED}❌ ERROR: Table verification failed${NC}"
  exit 1
fi

echo ""
echo "================================================================="
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo "================================================================="
echo ""
echo "Next steps:"
echo "  1. Test endpoints: ./scripts/test-endpoints.sh ${ENVIRONMENT}"
echo "  2. Verify data: psql -c 'SELECT COUNT(*) FROM behavior_journal;'"
echo ""

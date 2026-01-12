#!/bin/bash
# ============================================================================
# Migrate Behavior Journal Table to AWS RDS (Node.js Version)
# ============================================================================
# Uses Node.js instead of psql - works without PostgreSQL client
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================================="
echo "🗄️  Behavior Journal Table Migration (Node.js)"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ ERROR: Node.js not found${NC}"
  exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ ERROR: AWS CLI not found${NC}"
  exit 1
fi

echo -e "${BLUE}Step 1: Getting RDS information...${NC}"
echo ""

# Try Terraform first
cd "$PROJECT_ROOT/infra/envs/${ENVIRONMENT}" 2>/dev/null && {
  terraform init -backend-config=backend.hcl > /dev/null 2>&1
  RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
  RDS_SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
  RDS_DB_NAME=$(terraform output -raw rds_database_name 2>/dev/null || echo "warmpawz")
  RDS_PORT=$(terraform output -raw rds_port 2>/dev/null || echo "5432")
  AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "$REGION")
} || {
  # Fallback to AWS CLI
  RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
  RDS_ENDPOINT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$RDS_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].Endpoint' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ]; then
    echo -e "${RED}❌ ERROR: Could not determine RDS endpoint${NC}"
    exit 1
  fi
  
  RDS_PORT="5432"
  RDS_DB_NAME="warmpawz"
  AWS_REGION="$REGION"
  RDS_SECRET_ARN=""
}

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo -e "${RED}❌ ERROR: RDS endpoint not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ RDS Information:${NC}"
echo "   Endpoint: ${RDS_ENDPOINT}"
echo "   Port: ${RDS_PORT}"
echo "   Database: ${RDS_DB_NAME}"
echo ""

echo -e "${BLUE}Step 2: Getting credentials...${NC}"
echo ""

if [ -n "$RDS_SECRET_ARN" ] && [ "$RDS_SECRET_ARN" != "null" ]; then
  DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ARN" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$DB_SECRET" ]; then
    DB_PASSWORD=$(echo "$DB_SECRET" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.password||'')")
    DB_USERNAME=$(echo "$DB_SECRET" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.username||'postgres')")
  fi
fi

if [ -z "$DB_USERNAME" ]; then
  DB_USERNAME="postgres"
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo -e "${YELLOW}⚠️  Password not found, please enter:${NC}"
  read -s DB_PASSWORD
  echo ""
fi

# URL-encode password
DB_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('$DB_PASSWORD'))")

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:${RDS_PORT}/${RDS_DB_NAME}?sslmode=require"

echo -e "${GREEN}✅ Credentials retrieved${NC}"
echo ""

echo -e "${BLUE}Step 3: Running migration with Node.js...${NC}"
echo ""

cd "$PROJECT_ROOT/db"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci > /dev/null 2>&1 || npm install > /dev/null 2>&1
fi

# Create temporary migration runner
cat > run-single-migration.js << 'NODE_SCRIPT'
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATION_FILE = process.env.MIGRATION_FILE;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not set');
  process.exit(1);
}

if (!MIGRATION_FILE) {
  console.error('❌ ERROR: MIGRATION_FILE not set');
  process.exit(1);
}

// Parse connection string
const url = new URL(DATABASE_URL);
const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1), // Remove leading /
  user: url.username,
  password: url.password,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📄 Reading migration file...');
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    
    console.log('🚀 Executing migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully');
    
    // Verify table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'behavior_journal'
      )
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Table verification: behavior_journal exists');
      
      // Get index count
      const indexResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE tablename = 'behavior_journal'
      `);
      console.log(`✅ Indexes created: ${indexResult.rows[0].count}`);
    } else {
      console.log('⚠️  Warning: Table verification failed');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
NODE_SCRIPT

export DATABASE_URL="$DATABASE_URL"
export MIGRATION_FILE="$PROJECT_ROOT/db/migrations/055_behavior_journal_table.sql"

node run-single-migration.js

MIGRATION_EXIT=$?

# Cleanup
rm -f run-single-migration.js

if [ $MIGRATION_EXIT -ne 0 ]; then
  echo -e "${RED}❌ Migration failed${NC}"
  exit $MIGRATION_EXIT
fi

echo ""
echo "================================================================="
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo "================================================================="
echo ""

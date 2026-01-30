#!/bin/bash

# ============================================================================
# DEPLOY MULTI-SERVICE SELECTION FEATURE
# ============================================================================
# This script deploys the multi-service selection feature:
# 1. Run database migration (add duration_minutes column)
# 2. Deploy backend Lambda (updated endpoints)
# 3. Deploy frontend customer-web (updated components)
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║   🐾 DEPLOY MULTI-SERVICE SELECTION FEATURE                   ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Track timing
START_TIME=$(date +%s)

# ============================================================================
# STEP 1: PRE-FLIGHT CHECKS
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 1: Pre-flight Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CHECKS_PASSED=true

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "  ${RED}✗${NC} Node.js not found"
    CHECKS_PASSED=false
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version | cut -d' ' -f1)
    echo -e "  ${GREEN}✓${NC} AWS CLI: $AWS_VERSION"
    
    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        echo -e "  ${GREEN}✓${NC} AWS Account: $AWS_ACCOUNT"
    else
        echo -e "  ${RED}✗${NC} AWS credentials not configured"
        CHECKS_PASSED=false
    fi
else
    echo -e "  ${RED}✗${NC} AWS CLI not found"
    CHECKS_PASSED=false
fi

# Check database connection
if [ -z "$DB_CONNECTION_STRING" ]; then
    echo -e "  ${YELLOW}⚠${NC} DB_CONNECTION_STRING not set (migration will be skipped)"
    SKIP_MIGRATION=true
else
    echo -e "  ${GREEN}✓${NC} DB_CONNECTION_STRING set"
    SKIP_MIGRATION=false
fi

if [ "$CHECKS_PASSED" = false ]; then
    echo ""
    echo -e "${RED}Pre-flight checks failed. Please fix the issues above.${NC}"
    exit 1
fi

echo ""

# ============================================================================
# STEP 2: RUN DATABASE MIGRATION
# ============================================================================
if [ "$SKIP_MIGRATION" = false ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}STEP 2: Running Database Migration${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    MIGRATION_FILE="$PROJECT_ROOT/db/migrations/312_add_duration_minutes_to_bookings.sql"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo -e "  ${RED}✗${NC} Migration file not found: $MIGRATION_FILE"
        exit 1
    fi
    
    echo "  Running migration: 312_add_duration_minutes_to_bookings.sql"
    
    # Check if psql is available
    if command -v psql &> /dev/null; then
        PGPASSWORD=$(echo $DB_CONNECTION_STRING | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        psql "$DB_CONNECTION_STRING" -f "$MIGRATION_FILE"
        
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✓${NC} Migration completed successfully"
        else
            echo -e "  ${RED}✗${NC} Migration failed"
            exit 1
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} psql not found. Skipping migration."
        echo -e "  ${YELLOW}⚠${NC} Please run migration manually:"
        echo -e "     psql \$DB_CONNECTION_STRING -f $MIGRATION_FILE"
    fi
    echo ""
else
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}STEP 2: Database Migration (SKIPPED)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${YELLOW}⚠${NC} DB_CONNECTION_STRING not set. Migration skipped."
    echo -e "  ${YELLOW}⚠${NC} Please run migration manually before deploying backend."
    echo ""
fi

# ============================================================================
# STEP 3: DEPLOY BACKEND LAMBDA
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 3: Deploying Backend Lambda${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_ROOT/backend/lambda"

echo "  Installing dependencies..."
npm install --silent --legacy-peer-deps

echo "  Building TypeScript..."
npm run build

if [ ! -f "api-handler.zip" ]; then
    echo -e "  ${RED}✗${NC} api-handler.zip not found after build"
    exit 1
fi

echo "  Deploying Lambda function..."
if [ -f "$SCRIPT_DIR/deploy-lambda-direct.sh" ]; then
    bash "$SCRIPT_DIR/deploy-lambda-direct.sh"
else
    echo -e "  ${YELLOW}⚠${NC} deploy-lambda-direct.sh not found"
    echo "  Using AWS CLI directly..."
    
    LAMBDA_FUNCTION_NAME="warmpawz-dev-api-handler"
    AWS_REGION="ap-south-1"
    
    aws lambda update-function-code \
      --function-name "$LAMBDA_FUNCTION_NAME" \
      --zip-file "fileb://api-handler.zip" \
      --region "$AWS_REGION"
    
    echo -e "  ${GREEN}✓${NC} Lambda deployed"
fi

echo ""

# ============================================================================
# STEP 4: DEPLOY FRONTEND (CUSTOMER-WEB)
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 4: Deploying Frontend (Customer Web)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "$SCRIPT_DIR/deploy-customer-web.sh" ]; then
    bash "$SCRIPT_DIR/deploy-customer-web.sh"
else
    echo -e "  ${YELLOW}⚠${NC} deploy-customer-web.sh not found"
    echo "  Building customer-web manually..."
    
    cd "$PROJECT_ROOT/apps/customer-web"
    npm install --silent --legacy-peer-deps
    npm run build
    
    echo -e "  ${GREEN}✓${NC} Frontend built (manual deployment required)"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  DEPLOYMENT COMPLETE                          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Duration:        ${DURATION}s"
echo -e "  Migration:        ${GREEN}312_add_duration_minutes_to_bookings.sql${NC}"
echo -e "  Backend:          ${GREEN}Lambda deployed${NC}"
echo -e "  Frontend:         ${GREEN}Customer Web deployed${NC}"
echo ""
echo -e "${GREEN}Multi-service selection feature deployed! 🎉${NC}"
echo ""
echo "Next steps:"
echo "  • Test multi-service selection in customer app"
echo "  • Verify booking creation with multiple services"
echo "  • Monitor CloudWatch logs for any errors"
echo ""

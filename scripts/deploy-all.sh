#!/bin/bash
# ============================================================================
# WARMPAWZ - COMPLETE DEPLOYMENT SCRIPT
# ============================================================================
# 
# One-click deployment of the entire Warmpawz platform
#
# Usage:
#   ./scripts/deploy-all.sh dev       # Deploy everything to dev
#   ./scripts/deploy-all.sh staging   # Deploy everything to staging
#   ./scripts/deploy-all.sh prod      # Deploy everything to production
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ENVIRONMENT="${1:-dev}"

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║   🐾 WARMPAWZ - COMPLETE PLATFORM DEPLOYMENT                  ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
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

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "  ${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "  ${RED}✗${NC} npm not found"
    CHECKS_PASSED=false
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version | cut -d' ' -f1)
    echo -e "  ${GREEN}✓${NC} AWS CLI: $AWS_VERSION"
else
    echo -e "  ${RED}✗${NC} AWS CLI not found"
    CHECKS_PASSED=false
fi

# Check AWS credentials
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo -e "  ${GREEN}✓${NC} AWS Account: $AWS_ACCOUNT"
else
    echo -e "  ${RED}✗${NC} AWS credentials not configured"
    CHECKS_PASSED=false
fi

if [ "$CHECKS_PASSED" = false ]; then
    echo ""
    echo -e "${RED}Pre-flight checks failed. Please fix the issues above.${NC}"
    exit 1
fi

echo ""

# ============================================================================
# STEP 2: BUILD BACKEND
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 2: Building Backend Lambda${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_ROOT/backend/lambda"
echo "  Installing dependencies..."
npm install --silent --legacy-peer-deps
echo "  Compiling TypeScript..."
npm run build
echo -e "  ${GREEN}✓${NC} Backend build complete"
echo ""

# ============================================================================
# STEP 3: BUILD WEB APPS
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 3: Building Web Applications${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for APP in admin-web customer-web vendor-web; do
    echo "  Building $APP..."
    cd "$PROJECT_ROOT/apps/$APP"
    npm install --silent --legacy-peer-deps
    npm run build
    echo -e "  ${GREEN}✓${NC} $APP built"
done
echo ""

# ============================================================================
# STEP 4: DEPLOY AWS INFRASTRUCTURE
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 4: Deploying AWS Infrastructure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ENVIRONMENT" == "prod" ]; then
    echo -e "${YELLOW}⚠️  PRODUCTION DEPLOYMENT WARNING${NC}"
    read -p "Type 'DEPLOY PRODUCTION' to confirm: " CONFIRM
    if [ "$CONFIRM" != "DEPLOY PRODUCTION" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

cd "$PROJECT_ROOT/infrastructure/cdk"
npm install --silent

STACK_NAME="WarmpawzStack-$ENVIRONMENT"

echo "  Synthesizing CloudFormation..."
npx cdk synth $STACK_NAME > /dev/null

echo "  Deploying $STACK_NAME..."
npx cdk deploy $STACK_NAME --require-approval never --outputs-file cdk-outputs.json

echo -e "  ${GREEN}✓${NC} Infrastructure deployed"
echo ""

# Get outputs
API_URL=$(cat cdk-outputs.json | grep -o '"ApiGatewayUrl":"[^"]*' | cut -d'"' -f4 || echo "")

# ============================================================================
# STEP 5: VERIFY DEPLOYMENT
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 5: Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$API_URL" ]; then
    echo "  Testing API health endpoint..."
    HEALTH=$(curl -s "$API_URL/health" | head -c 100)
    if echo "$HEALTH" | grep -q "ok"; then
        echo -e "  ${GREEN}✓${NC} API health check passed"
    else
        echo -e "  ${YELLOW}⚠${NC} API health check returned: $HEALTH"
    fi
fi

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
echo -e "  Environment:     ${GREEN}$ENVIRONMENT${NC}"
echo -e "  Duration:        ${DURATION}s"
echo -e "  Stack:           $STACK_NAME"
if [ -n "$API_URL" ]; then
    echo -e "  API URL:         ${GREEN}$API_URL${NC}"
fi
echo ""
echo -e "${GREEN}Deployment successful! 🎉${NC}"
echo ""
echo "Next steps:"
echo "  • Mobile apps: ./scripts/build-mobile-apps.sh"
echo "  • Database migrations: Check db/migrations/"
echo "  • Monitor: AWS CloudWatch"

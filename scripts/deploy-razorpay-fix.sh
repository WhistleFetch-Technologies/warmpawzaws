#!/bin/bash
# ============================================================================
# Deploy Razorpay 503 Fix to Lambda
# ============================================================================
# This script builds and deploys the Razorpay error handling fixes
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🚀 Deploying Razorpay 503 Fix to Lambda"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Build Lambda
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Building Lambda${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_ROOT/backend/lambda"

echo "  Installing dependencies..."
npm install --silent --legacy-peer-deps 2>&1 | grep -v "npm WARN" || true

echo "  Compiling TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lambda build complete${NC}"
echo ""

# Step 2: Deploy with Serverless Framework
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Deploying Lambda${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if serverless is available (global or local)
if ! command -v serverless &> /dev/null; then
  # Try npx serverless (uses local or installs temporarily)
  if command -v npx &> /dev/null; then
    echo "  Using npx serverless..."
    SERVERLESS_CMD="npx serverless"
  else
    echo -e "${RED}❌ Serverless Framework not found and npx is not available${NC}"
    echo "   Please install serverless: npm install -g serverless"
    exit 1
  fi
else
  SERVERLESS_CMD="serverless"
fi

echo "  Deploying with Serverless Framework..."
$SERVERLESS_CMD deploy --stage "$ENVIRONMENT" --region "$AWS_REGION"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Deployment failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Lambda deployment complete!${NC}"
echo ""

# Step 3: Verify deployment
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Verifying Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "  Waiting for Lambda to be ready..."
sleep 5

# Test health endpoint
API_URL="https://z0b3obweb6.execute-api.$AWS_REGION.amazonaws.com"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ API is healthy (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${YELLOW}⚠️  API health check returned HTTP $HTTP_CODE${NC}"
  echo "   This may be normal if health endpoint is not configured"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ RAZORPAY FIX DEPLOYMENT COMPLETE                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "   ✅ Environment: $ENVIRONMENT"
echo -e "   ✅ Region: $AWS_REGION"
echo -e "   ✅ Lambda: warmpawz-$ENVIRONMENT-api-handler"
echo ""
echo -e "${YELLOW}📝 Fixes Deployed:${NC}"
echo "   1. Fixed BaseHandler.error() signature mismatch"
echo "   2. Fixed error response format (string vs object)"
echo "   3. Fixed Hono wrapper error parsing"
echo "   4. Increased timeouts (3s → 5s)"
echo "   5. Enhanced error logging"
echo ""
echo -e "${BLUE}🧪 Next Steps:${NC}"
echo "   1. Test Razorpay endpoint: ./scripts/test-razorpay-connectivity.sh $ENVIRONMENT $AWS_REGION"
echo "   2. Check CloudWatch logs for any errors"
echo "   3. Test payment flow in the application"
echo ""

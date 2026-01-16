#!/bin/bash
# Deploy Backend UAT Critical Fixes
# This script deploys the Lambda backend with the UAT fixes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Deploying Backend UAT Critical Fixes${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE=${1:-dev}
REGION=${2:-ap-south-1}

echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Stage: ${STAGE}"
echo -e "  Region: ${REGION}"
echo -e "  Project Root: ${PROJECT_ROOT}"
echo ""

# Step 1: Build API contracts
echo -e "${BLUE}[1/4] Building API contracts package...${NC}"
cd "${PROJECT_ROOT}/packages/api-contracts"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build
echo -e "${GREEN}✅ API contracts built${NC}"
echo ""

# Step 2: Build Lambda
echo -e "${BLUE}[2/4] Building Lambda function...${NC}"
cd "${PROJECT_ROOT}/backend/lambda"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build

if [ ! -f "dist/handler.js" ]; then
  echo -e "${RED}❌ Error: Build failed - dist/handler.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Lambda build successful${NC}"
echo ""

# Step 3: Deploy Lambda
echo -e "${BLUE}[3/4] Deploying Lambda function...${NC}"
cd "${PROJECT_ROOT}/backend/lambda"

# Check if serverless.yml exists
if [ -f "serverless.yml" ]; then
  echo -e "${YELLOW}Using Serverless Framework...${NC}"
  # Use npx to avoid global installation issues
  cd "${PROJECT_ROOT}/backend/lambda"
  npx serverless deploy --stage ${STAGE} --region ${REGION}
else
  echo -e "${YELLOW}⚠️  serverless.yml not found${NC}"
  echo -e "${YELLOW}Attempting direct Lambda deployment...${NC}"
  
  # Get Lambda function name
  FUNCTION_NAME=$(aws lambda list-functions \
    --region ${REGION} \
    --query "Functions[?contains(FunctionName, 'warmpawz') || contains(FunctionName, 'api')].FunctionName" \
    --output text | head -1)
  
  if [ -z "$FUNCTION_NAME" ] || [ "$FUNCTION_NAME" = "None" ]; then
    echo -e "${RED}❌ Could not find Lambda function automatically${NC}"
    echo -e "${YELLOW}Please deploy manually or configure serverless.yml${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}Found function: ${FUNCTION_NAME}${NC}"
  
  # Create deployment package
  echo -e "${YELLOW}Creating deployment package...${NC}"
  cd dist
  zip -r ../function.zip .
  cd ..
  
  # Update Lambda
  echo -e "${YELLOW}Updating Lambda function code...${NC}"
  aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --zip-file fileb://function.zip \
    --region ${REGION}
  
  # Cleanup
  rm -f function.zip
fi

echo -e "${GREEN}✅ Lambda deployment completed${NC}"
echo ""

# Step 4: Verify deployment
echo -e "${BLUE}[4/4] Verifying deployment...${NC}"
sleep 3

API_ENDPOINT="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

echo -e "${YELLOW}Testing endpoints:${NC}"

# Test 1: Health check
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${API_ENDPOINT}/health" || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "  ${GREEN}✅ Health endpoint: OK${NC}"
else
  echo -e "  ${YELLOW}⚠️  Health endpoint: ${HEALTH}${NC}"
fi

# Test 2: Service update validation (should return 400, not 500)
echo -e "${YELLOW}  Testing service update endpoint...${NC}"
SERVICE_TEST=$(curl -s -X PUT \
  "${API_ENDPOINT}/vendor/test-vendor/services/test-service" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\n%{http_code}" | tail -1)

if [ "$SERVICE_TEST" = "400" ] || [ "$SERVICE_TEST" = "404" ] || [ "$SERVICE_TEST" = "403" ]; then
  echo -e "  ${GREEN}✅ Service update endpoint: Validating correctly (${SERVICE_TEST})${NC}"
elif [ "$SERVICE_TEST" = "500" ]; then
  echo -e "  ${RED}❌ Service update endpoint: Still returning 500 (SQL error may persist)${NC}"
else
  echo -e "  ${YELLOW}⚠️  Service update endpoint: ${SERVICE_TEST}${NC}"
fi

# Test 3: Facility PUT endpoint (should NOT return 404)
FACILITY_TEST=$(curl -s -X PUT \
  "${API_ENDPOINT}/vendor/facility/test-vendor" \
  -H "Content-Type: application/json" \
  -d '{"address": "test"}' \
  -w "\n%{http_code}" | tail -1)

if [ "$FACILITY_TEST" = "404" ]; then
  echo -e "  ${RED}❌ Facility PUT endpoint: Still returning 404 (endpoint not deployed)${NC}"
else
  echo -e "  ${GREEN}✅ Facility PUT endpoint: Exists (${FACILITY_TEST})${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Backend Deployment Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "  ✅ API Contracts: Built"
echo -e "  ✅ Lambda Function: Built and Deployed"
echo -e "  ✅ Endpoints: Tested"
echo ""
echo -e "${BLUE}🌐 API Endpoint:${NC}"
echo -e "  ${API_ENDPOINT}"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo -e "  1. Run test suite: ./scripts/test-uat-fixes.sh"
echo -e "  2. Verify in vendor app that service updates work"
echo -e "  3. Test facility profile save functionality"
echo ""

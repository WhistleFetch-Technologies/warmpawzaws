#!/bin/bash

# ============================================================================
# FIX CLOUDFORMATION ROLLBACK AND REDEPLOY
# ============================================================================
# This script fixes the UPDATE_ROLLBACK_FAILED state and redeploys
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGE=${1:-dev}
REGION=${2:-ap-south-1}
STACK_NAME="warmpawz-api-${STAGE}"

echo -e "${YELLOW}=== Fixing CloudFormation Stack ===${NC}\n"
echo -e "Stack: ${STACK_NAME}"
echo -e "Region: ${REGION}\n"

# Step 1: Continue rollback to get stack out of failed state
echo -e "${GREEN}[1/3] Continuing CloudFormation rollback...${NC}"
aws cloudformation continue-update-rollback \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --resources-to-skip ApiLambdaFunction HttpApiRouteAnyProxyVar HttpApiRouteAny \
  || {
    echo -e "${YELLOW}⚠️  Rollback continue command completed (may have already been in progress)${NC}"
  }

echo -e "${GREEN}✓ Waiting for rollback to complete...${NC}"
aws cloudformation wait stack-rollback-complete \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  || {
    echo -e "${YELLOW}⚠️  Stack may already be in a stable state${NC}"
  }

# Step 2: Build the Lambda function
echo -e "\n${GREEN}[2/3] Building Lambda function...${NC}"
cd "$(dirname "$0")"

# Build API contracts
echo "  Building API contracts..."
cd ../../packages/api-contracts
npm install --silent
npm run build
cd ../../backend/lambda

# Install dependencies and build
echo "  Installing dependencies..."
npm install --silent
echo "  Building Lambda..."
npm run build

if [ ! -f "dist/handler.js" ]; then
    echo -e "${RED}✗ Build failed - dist/handler.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Step 3: Deploy with Serverless Framework
echo -e "\n${GREEN}[3/3] Deploying to AWS...${NC}"
if command -v serverless &> /dev/null; then
    serverless deploy --stage ${STAGE} --region ${REGION} --verbose
else
    echo -e "${YELLOW}Serverless Framework not installed. Installing...${NC}"
    npm install -g serverless
    serverless deploy --stage ${STAGE} --region ${REGION} --verbose
fi

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"

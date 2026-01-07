#!/bin/bash

# ============================================================================
# AWS SERVERLESS DEPLOYMENT SCRIPT
# ============================================================================
# Deploys Lambda function with CloudFront, RDS, and Cognito integration
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Warmpawz AWS Serverless Deployment ===${NC}\n"

# Check if stage is provided
STAGE=${1:-dev}
REGION=${2:-ap-south-1}

echo -e "${YELLOW}Stage: ${STAGE}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}\n"

# Step 1: Build API contracts package
echo -e "${GREEN}[1/5] Building API contracts package...${NC}"
cd ../../packages/api-contracts
npm install
npm run build
cd ../../backend/lambda

# Step 2: Install dependencies
echo -e "${GREEN}[2/5] Installing Lambda dependencies...${NC}"
npm install

# Step 3: Build Lambda function
echo -e "${GREEN}[3/5] Building Lambda function with esbuild...${NC}"
npm run build

# Step 4: Verify build
if [ ! -f "dist/handler.js" ]; then
    echo -e "${RED}Error: Build failed - dist/handler.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Step 5: Deploy with Serverless Framework
echo -e "${GREEN}[4/5] Deploying to AWS...${NC}"

if command -v serverless &> /dev/null; then
    serverless deploy --stage ${STAGE} --region ${REGION}
else
    echo -e "${YELLOW}Serverless Framework not installed. Installing...${NC}"
    npm install -g serverless
    serverless deploy --stage ${STAGE} --region ${REGION}
fi

# Step 6: Invalidate CloudFront cache
echo -e "${GREEN}[5/5] Invalidating CloudFront cache...${NC}"
# This is handled by serverless-cloudfront-invalidate plugin

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}API Endpoint: Check Serverless output above${NC}"
echo -e "${GREEN}CloudFront: Cache invalidated${NC}"


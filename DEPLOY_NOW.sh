#!/bin/bash

# ============================================================================
# DEPLOY HARD REFRESH FIX - QUICK DEPLOYMENT
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deploying Hard Refresh Fix${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Verify fix is in code
echo -e "${YELLOW}[1/4] Verifying code fix...${NC}"
if grep -q "full_name.*Customer.*phone.slice" backend/lambda/src/endpoints/auth-enhanced.ts; then
  echo -e "${GREEN}✓ Fix confirmed in code${NC}"
else
  echo -e "${RED}✗ Fix not found in code${NC}"
  exit 1
fi

# Step 2: Build backend
echo -e "${YELLOW}[2/4] Building backend...${NC}"
cd backend/lambda
npm run build
if [ -f "api-handler.zip" ]; then
  echo -e "${GREEN}✓ Build successful${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi
cd ../..

# Step 3: Deploy backend
echo -e "${YELLOW}[3/4] Deploying backend...${NC}"
echo -e "${BLUE}Choose deployment method:${NC}"
echo "1) AWS Lambda (Serverless Framework)"
echo "2) Manual upload (you'll upload api-handler.zip)"
read -p "Enter choice [1 or 2]: " choice

if [ "$choice" = "1" ]; then
  echo -e "${BLUE}Deploying with Serverless Framework...${NC}"
  cd backend/lambda
  if command -v serverless &> /dev/null; then
    serverless deploy --stage dev --region ap-south-1
  else
    echo -e "${YELLOW}Serverless not installed. Installing...${NC}"
    npm install -g serverless
    serverless deploy --stage dev --region ap-south-1
  fi
  cd ../..
elif [ "$choice" = "2" ]; then
  echo -e "${YELLOW}Manual deployment:${NC}"
  echo -e "${GREEN}Build package ready: backend/lambda/api-handler.zip${NC}"
  echo "Upload this file to your Lambda function via AWS Console or CLI"
  exit 0
else
  echo -e "${RED}Invalid choice${NC}"
  exit 1
fi

# Step 4: Test deployment
echo -e "${YELLOW}[4/4] Testing deployment...${NC}"
echo -e "${BLUE}Testing customer OTP verify...${NC}"
sleep 3  # Wait for deployment to propagate

TEST_RESULT=$(curl -s -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456", "role": "customer"}')

if echo "$TEST_RESULT" | grep -q '"success":true\|"access_token"'; then
  echo -e "${GREEN}✓ Deployment successful! Customer login works.${NC}"
else
  echo -e "${YELLOW}⚠ Deployment may still be propagating...${NC}"
  echo "Response: $TEST_RESULT"
  echo ""
  echo "Wait a few minutes and test manually:"
  echo "./test-login-flows.sh"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backend Deployment Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run: ./test-login-flows.sh"
echo "2. Deploy frontend apps"
echo "3. Test in browser"

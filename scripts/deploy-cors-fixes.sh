#!/bin/bash

# Deployment script for CORS and 500 error fixes
# This script builds and deploys the Lambda function with the fixes

set -e  # Exit on error

echo "🚀 Deploying CORS and 500 Error Fixes"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the stage from command line or use default
STAGE=${1:-dev}

echo -e "${YELLOW}Deployment Stage: ${STAGE}${NC}"
echo ""

# Step 1: Navigate to lambda directory
echo "📁 Step 1: Navigating to Lambda directory..."
cd "$(dirname "$0")/../backend/lambda" || exit 1
echo "✅ Current directory: $(pwd)"
echo ""

# Step 2: Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Step 3: Build the Lambda function
echo "🔨 Step 2: Building Lambda function..."
if npm run build; then
  echo -e "${GREEN}✅ Build successful${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi
echo ""

# Step 4: Deploy using Serverless Framework
echo "🚀 Step 3: Deploying to AWS..."
echo -e "${YELLOW}This may take a few minutes...${NC}"
if npx serverless deploy --stage "$STAGE"; then
  echo -e "${GREEN}✅ Deployment successful${NC}"
else
  echo -e "${RED}❌ Deployment failed${NC}"
  exit 1
fi
echo ""

# Step 5: Wait for deployment to propagate
echo "⏳ Step 4: Waiting for deployment to propagate (10 seconds)..."
sleep 10
echo ""

# Step 6: Test OPTIONS request
echo "🧪 Step 5: Testing OPTIONS request (CORS preflight)..."
OPTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type' \
  --max-time 10)

if [ "$OPTIONS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ OPTIONS request returns 200 OK${NC}"
else
  echo -e "${YELLOW}⚠️  OPTIONS request returned ${OPTIONS_STATUS} (expected 200)${NC}"
  echo "   This might be normal if deployment is still propagating. Wait a few minutes and test again."
fi
echo ""

# Step 7: Test notifications endpoint
echo "🧪 Step 6: Testing notifications endpoint..."
NOTIFICATIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/notifications/9611377119?limit=10' \
  --max-time 10)

if [ "$NOTIFICATIONS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Notifications endpoint returns 200 OK${NC}"
else
  echo -e "${YELLOW}⚠️  Notifications endpoint returned ${NOTIFICATIONS_STATUS} (expected 200)${NC}"
  echo "   This might be normal if deployment is still propagating. Wait a few minutes and test again."
fi
echo ""

# Summary
echo "======================================"
echo "📊 Deployment Summary"
echo "======================================"
echo "Stage: ${STAGE}"
echo "OPTIONS Status: ${OPTIONS_STATUS}"
echo "Notifications Status: ${NOTIFICATIONS_STATUS}"
echo ""

if [ "$OPTIONS_STATUS" = "200" ] && [ "$NOTIFICATIONS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ All tests passed! Deployment successful.${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Test in browser (clear cache first)"
  echo "2. Monitor CloudWatch logs: aws logs tail /aws/lambda/warmpawz-api --follow --region ap-south-1"
  echo "3. Verify CORS errors are gone in browser console"
else
  echo -e "${YELLOW}⚠️  Some tests didn't pass.${NC}"
  echo ""
  echo "This might be normal if:"
  echo "- Deployment is still propagating (wait 2-3 minutes)"
  echo "- API Gateway cache needs to clear"
  echo ""
  echo "Try testing again in a few minutes:"
  echo "./scripts/test-cors-preflight.sh"
fi
echo ""

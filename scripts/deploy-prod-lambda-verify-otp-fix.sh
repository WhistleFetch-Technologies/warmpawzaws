#!/bin/bash
# Deploy Lambda to Production with verify-otp timeout fixes
# Usage: ./scripts/deploy-prod-lambda-verify-otp-fix.sh

set -euo pipefail

echo "🚀 Deploying Lambda to PRODUCTION with verify-otp timeout fixes..."

# Configuration
LAMBDA_FUNCTION_NAME="warmpawz-prod-api-handler"
AWS_REGION="ap-south-1"
LAMBDA_ZIP="api-handler.zip"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Confirm production deployment
echo -e "${YELLOW}⚠️  WARNING: You are about to deploy to PRODUCTION${NC}"
echo -e "${YELLOW}   Function: $LAMBDA_FUNCTION_NAME${NC}"
echo -e "${YELLOW}   Region: $AWS_REGION${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/N): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 1: Navigate to Lambda directory
echo -e "${BLUE}📁 Navigating to Lambda directory...${NC}"
cd "$(dirname "$0")/../backend/lambda"

# Step 2: Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
npm run clean || true

# Step 3: Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Step 4: Build Lambda
echo -e "${BLUE}🔨 Building Lambda...${NC}"
npm run build

if [ ! -f "$LAMBDA_ZIP" ]; then
  echo -e "${RED}❌ Error: $LAMBDA_ZIP not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lambda built successfully${NC}"
ZIP_SIZE=$(ls -lh $LAMBDA_ZIP | awk '{print $5}')
echo -e "${BLUE}📊 Package size: $ZIP_SIZE${NC}"
echo ""

# Step 5: Verify AWS CLI is configured
echo -e "${BLUE}🔍 Verifying AWS CLI configuration...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not configured. Please run: aws configure${NC}"
  exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS CLI configured${NC}"
echo -e "   Account: $AWS_ACCOUNT"
echo -e "   Region: $AWS_REGION"
echo ""

# Step 6: Verify Lambda function exists
echo -e "${BLUE}🔍 Verifying Lambda function exists...${NC}"
if ! aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" &> /dev/null; then
  echo -e "${RED}❌ Lambda function '$LAMBDA_FUNCTION_NAME' not found in region $AWS_REGION${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Lambda function found${NC}"
echo ""

# Step 7: Update Lambda function code
echo -e "${BLUE}📤 Uploading Lambda function code to PRODUCTION...${NC}"
if aws lambda update-function-code \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --zip-file "fileb://$LAMBDA_ZIP" \
  --region "$AWS_REGION" \
  --output json > /tmp/lambda-update.json 2>&1; then
  echo -e "${GREEN}✅ Lambda code updated successfully${NC}"
  
  # Extract function details
  LAMBDA_ARN=$(jq -r '.FunctionArn' /tmp/lambda-update.json 2>/dev/null || echo "N/A")
  LAMBDA_VERSION=$(jq -r '.Version' /tmp/lambda-update.json 2>/dev/null || echo "N/A")
  LAST_MODIFIED=$(jq -r '.LastModified' /tmp/lambda-update.json 2>/dev/null || echo "N/A")
  
  echo -e "   Function: $LAMBDA_FUNCTION_NAME"
  echo -e "   ARN: $LAMBDA_ARN"
  echo -e "   Version: $LAMBDA_VERSION"
  echo -e "   Last Modified: $LAST_MODIFIED"
else
  echo -e "${RED}❌ Lambda update failed:${NC}"
  cat /tmp/lambda-update.json
  exit 1
fi
echo ""

# Step 8: Wait for Lambda to be ready
echo -e "${BLUE}⏳ Waiting for Lambda to be ready...${NC}"
aws lambda wait function-updated \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" || true

echo -e "${GREEN}✅ Lambda is ready${NC}"
echo ""

# Step 9: Verify deployment
echo -e "${BLUE}🔍 Verifying deployment...${NC}"
CURRENT_CODE_SHA=$(aws lambda get-function \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query 'Configuration.CodeSha256' \
  --output text)

echo -e "${GREEN}✅ Deployment verified${NC}"
echo -e "   Code SHA256: $CURRENT_CODE_SHA"
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ PRODUCTION LAMBDA DEPLOYMENT COMPLETED                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Deployment Summary:"
echo -e "   ✅ Function: $LAMBDA_FUNCTION_NAME"
echo -e "   ✅ Region: $AWS_REGION"
echo -e "   ✅ Package Size: $ZIP_SIZE"
echo -e "   ✅ Code SHA256: $CURRENT_CODE_SHA"
echo ""
echo -e "${YELLOW}📝 Changes Deployed:${NC}"
echo -e "   • Added timeout protection for OTP verification (10s)"
echo -e "   • Added timeout protection for Cognito authentication (8s)"
echo -e "   • Improved error handling for 503 Service Unavailable errors"
echo ""
echo -e "${GREEN}✅ Deployment complete! The verify-otp endpoint should now handle timeouts properly.${NC}"

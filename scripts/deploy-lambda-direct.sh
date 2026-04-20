#!/bin/bash
# Direct AWS CLI deployment script for Lambda
# Usage: ./scripts/deploy-lambda-direct.sh

set -euo pipefail

echo "🚀 Deploying Lambda with updated endpoints..."

# Configuration
# Allow override via environment variable (dev default matches AWS account naming)
# Dev: warmpawz-dev-api-handler  |  Prod: LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-dev-api-handler}"
# SQS consumer for ActionOccurred → loyalty (must be updated when loyalty-points-service earn logic changes).
# Dev: warmpawz-dev-loyalty-events-consumer | Prod: LOYALTY_CONSUMER_FUNCTION_NAME=warmpawz-prod-loyalty-events-consumer
LOYALTY_CONSUMER_FUNCTION_NAME="${LOYALTY_CONSUMER_FUNCTION_NAME:-warmpawz-dev-loyalty-events-consumer}"
AWS_REGION="ap-south-1"
LAMBDA_ZIP="api-handler.zip"
LOYALTY_CONSUMER_ZIP="loyalty-consumer.zip"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Build Lambda
echo -e "${BLUE}📦 Building Lambda...${NC}"
cd "$(dirname "$0")/../backend/lambda"
npm run build

if [ ! -f "$LAMBDA_ZIP" ]; then
  echo -e "${RED}❌ Error: $LAMBDA_ZIP not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lambda built successfully${NC}"
echo -e "${BLUE}📊 Package size: $(ls -lh $LAMBDA_ZIP | awk '{print $5}')${NC}"
echo ""

# Step 2: Update Lambda function code
echo -e "${BLUE}📤 Uploading Lambda function code...${NC}"
if aws lambda update-function-code \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --zip-file "fileb://$LAMBDA_ZIP" \
  --region "$AWS_REGION" \
  --output text > /tmp/lambda-update.txt 2>&1; then
  echo -e "${GREEN}✅ Lambda updated successfully${NC}"
  if command -v jq > /dev/null 2>&1; then
    LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" --query 'Configuration.FunctionArn' --output text)
    LAMBDA_VERSION=$(aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" --query 'Configuration.Version' --output text)
    echo -e "   Function: $LAMBDA_FUNCTION_NAME"
    echo -e "   ARN: $LAMBDA_ARN"
    echo -e "   Version: $LAMBDA_VERSION"
  else
    echo -e "   Function: $LAMBDA_FUNCTION_NAME"
    echo -e "   Region: $AWS_REGION"
  fi
else
  echo -e "${RED}❌ Lambda update failed:${NC}"
  cat /tmp/lambda-update.txt
  exit 1
fi
echo ""

# Step 3: Wait for Lambda to be ready
echo -e "${BLUE}⏳ Waiting for Lambda to be ready...${NC}"
aws lambda wait function-updated \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" || true

echo -e "${GREEN}✅ Lambda deployment complete!${NC}"
echo ""

# Optional: loyalty-events-consumer (separate Lambda; npm package step produces loyalty-consumer.zip)
if [ -f "$(dirname "$0")/../backend/lambda/$LOYALTY_CONSUMER_ZIP" ]; then
  echo -e "${BLUE}📤 Uploading loyalty-events-consumer...${NC}"
  LC_ZIP="$(cd "$(dirname "$0")/../backend/lambda" && pwd)/$LOYALTY_CONSUMER_ZIP"
  if aws lambda update-function-code \
    --function-name "$LOYALTY_CONSUMER_FUNCTION_NAME" \
    --zip-file "fileb://$LC_ZIP" \
    --region "$AWS_REGION" \
    --output text > /tmp/lambda-loyalty-update.txt 2>&1; then
    echo -e "${GREEN}✅ Loyalty consumer updated: $LOYALTY_CONSUMER_FUNCTION_NAME${NC}"
    aws lambda wait function-updated \
      --function-name "$LOYALTY_CONSUMER_FUNCTION_NAME" \
      --region "$AWS_REGION" || true
  else
    echo -e "${YELLOW}⚠️  Loyalty consumer update skipped or failed (check /tmp/lambda-loyalty-update.txt)${NC}"
    cat /tmp/lambda-loyalty-update.txt 2>/dev/null || true
  fi
  echo ""
fi

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ LAMBDA DEPLOYMENT COMPLETED                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Deployment Summary:"
echo -e "   ✅ Lambda: $LAMBDA_FUNCTION_NAME"
if [ -f "$(dirname "$0")/../backend/lambda/$LOYALTY_CONSUMER_ZIP" ]; then
  echo -e "   ✅ Loyalty consumer: $LOYALTY_CONSUMER_FUNCTION_NAME (if upload succeeded)"
fi
if [ ! -z "${LAMBDA_VERSION:-}" ]; then
  echo -e "   ✅ Version: $LAMBDA_VERSION"
fi
echo -e "   ✅ Region: $AWS_REGION"
echo ""


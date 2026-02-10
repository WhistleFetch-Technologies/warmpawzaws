#!/bin/bash

# ============================================================================
# Check Production UAT Mode Status
# ============================================================================
# This script checks if production Lambda is running in UAT mode
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-api-prod}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Production UAT Mode Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install it.${NC}"
  exit 1
fi

echo -e "${YELLOW}Checking Lambda function configuration...${NC}"
echo "Function: ${LAMBDA_FUNCTION_NAME}"
echo "Region: ${AWS_REGION}"
echo ""

# Get Lambda environment variables
ENV_VARS=$(aws lambda get-function-configuration \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --region "${AWS_REGION}" \
  --query 'Environment.Variables' \
  --output json 2>/dev/null) || {
  echo -e "${RED}❌ Failed to get Lambda configuration${NC}"
  echo "Make sure you have AWS credentials configured and the function exists."
  exit 1
}

# Extract key environment variables
UAT_MODE=$(echo "$ENV_VARS" | jq -r '.UAT_MODE // "not set"')
NODE_ENV=$(echo "$ENV_VARS" | jq -r '.NODE_ENV // "not set"')
ENVIRONMENT=$(echo "$ENV_VARS" | jq -r '.ENVIRONMENT // "not set"')
FUNCTION_NAME=$(echo "$ENV_VARS" | jq -r '.AWS_LAMBDA_FUNCTION_NAME // "not set"')

echo -e "${BLUE}Environment Variables:${NC}"
echo "  UAT_MODE: ${UAT_MODE}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  ENVIRONMENT: ${ENVIRONMENT}"
echo "  AWS_LAMBDA_FUNCTION_NAME: ${FUNCTION_NAME}"
echo ""

# Determine UAT mode status based on auth-enhanced.ts logic
IS_UAT_MODE=false

if [ "$UAT_MODE" = "true" ]; then
  IS_UAT_MODE=true
elif [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "dev" ]; then
  IS_UAT_MODE=true
elif [ "$ENVIRONMENT" = "dev" ]; then
  IS_UAT_MODE=true
elif [[ "$FUNCTION_NAME" == *"dev"* ]]; then
  IS_UAT_MODE=true
fi

echo -e "${BLUE}========================================${NC}"
if [ "$IS_UAT_MODE" = true ]; then
  echo -e "${RED}⚠️  PRODUCTION IS IN UAT MODE!${NC}"
  echo ""
  echo "This means:"
  echo "  - OTPs will be fixed to '123456'"
  echo "  - SMS sending will be skipped"
  echo "  - UAT authentication may be enabled"
  echo ""
  echo -e "${YELLOW}This is NOT recommended for production!${NC}"
else
  echo -e "${GREEN}✅ Production is NOT in UAT mode${NC}"
  echo ""
  echo "This means:"
  echo "  - OTPs will be randomly generated"
  echo "  - SMS will be sent (if configured)"
  echo "  - Real authentication is enabled"
fi
echo -e "${BLUE}========================================${NC}"

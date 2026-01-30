#!/bin/bash
# ============================================================================
# Update Lambda Timeout Configuration
# ============================================================================
# Updates Lambda function timeout to 60 seconds for Razorpay API calls
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}
TIMEOUT=${3:-60}

echo "🔧 Updating Lambda Timeout Configuration"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

LAMBDA_FUNCTION_NAME="warmpawz-${ENVIRONMENT}-api-handler"

echo -e "${BLUE}Updating Lambda function timeout...${NC}"

# Update Lambda configuration
if aws lambda update-function-configuration \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --timeout $TIMEOUT \
  --region "$AWS_REGION" \
  --output json > /tmp/lambda-config-update.json 2>&1; then
  
  echo -e "${GREEN}✅ Lambda timeout updated successfully${NC}"
  
  # Get updated configuration
  CURRENT_TIMEOUT=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Timeout' \
    --output text 2>/dev/null || echo "unknown")
  
  echo -e "   Function: $LAMBDA_FUNCTION_NAME"
  echo -e "   Timeout: ${CURRENT_TIMEOUT}s"
  echo -e "   Region: $AWS_REGION"
  echo ""
  
  echo -e "${BLUE}⏳ Waiting for configuration update to complete...${NC}"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" || true
  
  echo -e "${GREEN}✅ Lambda configuration update complete!${NC}"
else
  echo -e "${RED}❌ Lambda timeout update failed:${NC}"
  cat /tmp/lambda-config-update.json
  exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ LAMBDA TIMEOUT UPDATED                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ Function: $LAMBDA_FUNCTION_NAME"
echo -e "   ✅ Timeout: ${TIMEOUT}s (was 30s)"
echo -e "   ✅ Reason: Allows time for Secrets Manager + Razorpay API + VPC cold starts"
echo ""

#!/bin/bash

# ============================================================================
# Fix Production 503 Service Unavailable Errors
# ============================================================================
# Immediate fixes for the 503 errors
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-prod-api-handler}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
NEW_CONCURRENCY="${NEW_CONCURRENCY:-200}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fix Production 503 Errors${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Lambda Function: ${LAMBDA_FUNCTION_NAME}"
echo "Current Reserved Concurrency: 100"
echo "New Reserved Concurrency: ${NEW_CONCURRENCY}"
echo ""

# Step 1: Increase Reserved Concurrency
echo -e "${YELLOW}[1/2] Increasing reserved concurrency...${NC}"
aws lambda put-function-concurrency \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --reserved-concurrent-executions "${NEW_CONCURRENCY}" \
  --region "${AWS_REGION}" || {
  echo -e "${RED}❌ Failed to update concurrency${NC}"
  exit 1
}

echo -e "${GREEN}✅ Reserved concurrency increased to ${NEW_CONCURRENCY}${NC}"
echo ""

# Step 2: Verify
echo -e "${YELLOW}[2/2] Verifying...${NC}"
CURRENT_CONCURRENCY=$(aws lambda get-function-configuration \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --region "${AWS_REGION}" \
  --query 'ReservedConcurrentExecutions' \
  --output text)

if [ "$CURRENT_CONCURRENCY" = "$NEW_CONCURRENCY" ]; then
  echo -e "${GREEN}✅ Verification passed! Reserved concurrency is now ${NEW_CONCURRENCY}${NC}"
else
  echo -e "${YELLOW}⚠️  Current concurrency: ${CURRENT_CONCURRENCY} (expected ${NEW_CONCURRENCY})${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Fix Applied!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor concurrent executions:"
echo "   aws cloudwatch get-metric-statistics \\"
echo "     --namespace AWS/Lambda \\"
echo "     --metric-name ConcurrentExecutions \\"
echo "     --dimensions Name=FunctionName,Value=${LAMBDA_FUNCTION_NAME} \\"
echo "     --start-time \$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \\"
echo "     --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\"
echo "     --period 60 \\"
echo "     --statistics Maximum \\"
echo "     --region ${AWS_REGION}"
echo ""
echo "2. Investigate invocation spike:"
echo "   Check what's causing 28k+ invocations per 5 minutes"
echo ""
echo "3. Test health endpoint:"
echo "   curl -X GET 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health'"
echo ""

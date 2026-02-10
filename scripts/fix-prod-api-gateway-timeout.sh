#!/bin/bash

# ============================================================================
# Fix Production API Gateway Timeout Issue
# ============================================================================
# Enables provisioned concurrency to eliminate cold starts
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-prod-api-handler}"
PROVISIONED_CONCURRENCY="${PROVISIONED_CONCURRENCY:-2}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fix Production API Gateway Timeout${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Lambda Function: ${LAMBDA_FUNCTION_NAME}"
echo "Provisioned Concurrency: ${PROVISIONED_CONCURRENCY}"
echo "Region: ${AWS_REGION}"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install it.${NC}"
  exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
  exit 1
fi

# Step 1: Enable Provisioned Concurrency
echo -e "${YELLOW}[1/3] Enabling provisioned concurrency...${NC}"
RESULT=$(aws lambda put-provisioned-concurrency-config \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --qualifier '$LATEST' \
  --provisioned-concurrent-executions "${PROVISIONED_CONCURRENCY}" \
  --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ Failed to enable provisioned concurrency${NC}"
  echo "Error: ${RESULT}"
  exit 1
}

echo -e "${GREEN}✅ Provisioned concurrency enabled${NC}"
echo "  Allocated: ${PROVISIONED_CONCURRENCY} concurrent executions"
echo ""

# Step 2: Increase Lambda timeout (optional, for buffer)
echo -e "${YELLOW}[2/3] Increasing Lambda timeout to 60s (for error buffer)...${NC}"
TIMEOUT_RESULT=$(aws lambda update-function-configuration \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --timeout 60 \
  --region "${AWS_REGION}" 2>&1) || {
  echo -e "${YELLOW}⚠️  Could not update timeout (may need permissions)${NC}"
  echo "Error: ${TIMEOUT_RESULT}"
} && {
  echo -e "${GREEN}✅ Lambda timeout increased to 60s${NC}"
}
echo ""

# Step 3: Wait for provisioned concurrency to be ready
echo -e "${YELLOW}[3/3] Waiting for provisioned concurrency to be ready...${NC}"
echo "This may take 1-2 minutes..."
echo ""

MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  STATUS=$(aws lambda get-provisioned-concurrency-config \
    --function-name "${LAMBDA_FUNCTION_NAME}" \
    --qualifier '$LATEST' \
    --region "${AWS_REGION}" \
    --query 'Status' \
    --output text 2>/dev/null || echo "PENDING")
  
  if [ "$STATUS" = "READY" ]; then
    echo -e "${GREEN}✅ Provisioned concurrency is READY!${NC}"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo -e "${RED}❌ Provisioned concurrency failed to initialize${NC}"
    exit 1
  else
    echo "  Status: ${STATUS} (waiting...)"
    sleep 5
    WAITED=$((WAITED + 5))
  fi
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠️  Timeout waiting for provisioned concurrency${NC}"
  echo "It may still be initializing. Check status manually:"
  echo "  aws lambda get-provisioned-concurrency-config --function-name ${LAMBDA_FUNCTION_NAME} --qualifier '\$LATEST' --region ${AWS_REGION}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Fix Applied Successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test the health endpoint:"
echo "   curl -X GET 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health'"
echo ""
echo "2. Monitor CloudWatch logs:"
echo "   aws logs tail /aws/lambda/${LAMBDA_FUNCTION_NAME} --follow --region ${AWS_REGION}"
echo ""
echo "3. Check metrics:"
echo "   aws cloudwatch get-metric-statistics \\"
echo "     --namespace AWS/Lambda \\"
echo "     --metric-name Duration \\"
echo "     --dimensions Name=FunctionName,Value=${LAMBDA_FUNCTION_NAME} \\"
echo "     --start-time \$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \\"
echo "     --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\"
echo "     --period 300 \\"
echo "     --statistics Average,Maximum \\"
echo "     --region ${AWS_REGION}"
echo ""

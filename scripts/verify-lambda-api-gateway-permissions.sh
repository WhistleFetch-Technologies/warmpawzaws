#!/bin/bash

# ============================================================================
# Verify Lambda API Gateway Permissions
# ============================================================================
# Checks all Lambda functions and their API Gateway permissions
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AWS_REGION="${AWS_REGION:-ap-south-1}"
PROD_API_ID="mss9sa4y01"
DEV_API_ID="z0b3obweb6"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Lambda API Gateway Permissions Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "PROD API Gateway: ${PROD_API_ID}"
echo "DEV API Gateway: ${DEV_API_ID}"
echo ""

# Get all Lambda functions
echo -e "${YELLOW}Checking all Lambda functions...${NC}"
FUNCTIONS=$(aws lambda list-functions --region "${AWS_REGION}" --query "Functions[*].FunctionName" --output text)

for FUNCTION in $FUNCTIONS; do
  # Skip if function name doesn't contain "api" or "warmpawz"
  if [[ ! "$FUNCTION" =~ (api|warmpawz) ]]; then
    continue
  fi
  
  echo ""
  echo -e "${CYAN}Function: ${FUNCTION}${NC}"
  
  # Get policy
  POLICY=$(aws lambda get-policy --function-name "${FUNCTION}" --region "${AWS_REGION}" 2>&1) || {
    echo "  No policy found or error: ${POLICY}"
    continue
  }
  
  # Extract API Gateway ARN from policy
  API_ARN=$(echo "$POLICY" | jq -r '.Policy' | jq -r '.Statement[]? | select(.Principal.Service == "apigateway.amazonaws.com") | .Condition.ArnLike."AWS:SourceArn" // empty' | head -1)
  
  if [ -z "$API_ARN" ]; then
    echo "  No API Gateway permission found"
    continue
  fi
  
  # Extract API ID from ARN
  API_ID=$(echo "$API_ARN" | grep -oP 'execute-api:[^:]+:\d+:\K[^/]+' || echo "")
  
  if [ -z "$API_ID" ]; then
    echo "  Could not extract API ID from ARN: ${API_ARN}"
    continue
  fi
  
  # Check if it's PROD or DEV
  if [[ "$FUNCTION" =~ prod ]]; then
    if [ "$API_ID" = "$PROD_API_ID" ]; then
      echo -e "  ${GREEN}✅ CORRECT: PROD function has PROD API Gateway permission${NC}"
    else
      echo -e "  ${RED}❌ WRONG: PROD function has ${API_ID} (should be ${PROD_API_ID})${NC}"
    fi
  elif [[ "$FUNCTION" =~ dev ]]; then
    if [ "$API_ID" = "$DEV_API_ID" ]; then
      echo -e "  ${GREEN}✅ CORRECT: DEV function has DEV API Gateway permission${NC}"
    else
      echo -e "  ${RED}❌ WRONG: DEV function has ${API_ID} (should be ${DEV_API_ID})${NC}"
    fi
  else
    echo "  API Gateway: ${API_ID} (unknown environment)"
  fi
done

echo ""
echo -e "${BLUE}========================================${NC}"

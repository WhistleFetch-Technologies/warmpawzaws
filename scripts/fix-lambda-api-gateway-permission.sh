#!/bin/bash

# ============================================================================
# Fix Lambda API Gateway Permission
# ============================================================================
# Fixes incorrect API Gateway permissions on Lambda functions
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FUNCTION_NAME="${1}"
PROD_API_ID="mss9sa4y01"
DEV_API_ID="z0b3obweb6"
AWS_REGION="${AWS_REGION:-ap-south-1}"

if [ -z "$FUNCTION_NAME" ]; then
  echo -e "${RED}Usage: $0 <lambda-function-name>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 warmpawz-prod-api-handler"
  exit 1
fi

# Determine which API Gateway to use based on function name
if [[ "$FUNCTION_NAME" =~ prod ]]; then
  API_ID="$PROD_API_ID"
  ENV="PROD"
elif [[ "$FUNCTION_NAME" =~ dev ]]; then
  API_ID="$DEV_API_ID"
  ENV="DEV"
else
  echo -e "${YELLOW}⚠️  Cannot determine environment from function name${NC}"
  echo "Please specify API Gateway ID manually:"
  read -p "API Gateway ID: " API_ID
  ENV="UNKNOWN"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fix Lambda API Gateway Permission${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Lambda Function: ${FUNCTION_NAME}"
echo "Environment: ${ENV}"
echo "API Gateway ID: ${API_ID}"
echo ""

# Get current policy
echo -e "${YELLOW}[1/3] Checking current policy...${NC}"
CURRENT_POLICY=$(aws lambda get-policy --function-name "${FUNCTION_NAME}" --region "${AWS_REGION}" 2>&1) || {
  echo -e "${RED}❌ Function not found or no policy exists${NC}"
  exit 1
}

CURRENT_API_ARN=$(echo "$CURRENT_POLICY" | jq -r '.Policy' | jq -r '.Statement[]? | select(.Principal.Service == "apigateway.amazonaws.com") | .Condition.ArnLike."AWS:SourceArn" // empty' | head -1)
CURRENT_API_ID=$(echo "$CURRENT_API_ARN" | grep -oP 'execute-api:[^:]+:\d+:\K[^/]+' || echo "")

echo "  Current API Gateway: ${CURRENT_API_ID}"
echo "  Target API Gateway: ${API_ID}"
echo ""

if [ "$CURRENT_API_ID" = "$API_ID" ]; then
  echo -e "${GREEN}✅ Permission is already correct!${NC}"
  exit 0
fi

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create new policy
echo -e "${YELLOW}[2/3] Creating new policy...${NC}"
NEW_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Id": "default",
  "Statement": [
    {
      "Sid": "AllowAPIGatewayInvoke-${FUNCTION_NAME}",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*"
        }
      }
    }
  ]
}
EOF
)

# Remove old policy first (if exists)
echo -e "${YELLOW}[3/3] Updating Lambda permission...${NC}"
aws lambda remove-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id "AllowAPIGatewayInvoke-${FUNCTION_NAME}" \
  --region "${AWS_REGION}" 2>/dev/null || {
  # Try to remove with old statement ID
  OLD_SID=$(echo "$CURRENT_POLICY" | jq -r '.Policy' | jq -r '.Statement[0].Sid // empty')
  if [ -n "$OLD_SID" ]; then
    aws lambda remove-permission \
      --function-name "${FUNCTION_NAME}" \
      --statement-id "$OLD_SID" \
      --region "${AWS_REGION}" 2>/dev/null || true
  fi
}

# Add new permission
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id "AllowAPIGatewayInvoke-${FUNCTION_NAME}" \
  --action "lambda:InvokeFunction" \
  --principal "apigateway.amazonaws.com" \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
  --region "${AWS_REGION}" || {
  echo -e "${RED}❌ Failed to add permission${NC}"
  exit 1
}

echo -e "${GREEN}✅ Permission updated successfully!${NC}"
echo ""
echo "Verifying..."
VERIFY_POLICY=$(aws lambda get-policy --function-name "${FUNCTION_NAME}" --region "${AWS_REGION}")
VERIFY_API_ID=$(echo "$VERIFY_POLICY" | jq -r '.Policy' | jq -r '.Statement[]? | select(.Principal.Service == "apigateway.amazonaws.com") | .Condition.ArnLike."AWS:SourceArn" // empty' | grep -oP 'execute-api:[^:]+:\d+:\K[^/]+' || echo "")

if [ "$VERIFY_API_ID" = "$API_ID" ]; then
  echo -e "${GREEN}✅ Verification passed! API Gateway ${API_ID} can now invoke ${FUNCTION_NAME}${NC}"
else
  echo -e "${RED}❌ Verification failed. Current API ID: ${VERIFY_API_ID}, Expected: ${API_ID}${NC}"
  exit 1
fi

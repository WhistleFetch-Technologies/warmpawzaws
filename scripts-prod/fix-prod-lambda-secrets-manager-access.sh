#!/bin/bash

# ============================================================================
# Fix Production Lambda Secrets Manager Access
# ============================================================================
# Adds Secrets Manager permissions to Lambda execution role
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
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fix Lambda Secrets Manager Access${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get Lambda role
echo -e "${YELLOW}[1/4] Getting Lambda execution role...${NC}"
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --region "${AWS_REGION}" \
  --query 'Configuration.Role' \
  --output text)

ROLE_NAME=$(echo "$ROLE_ARN" | grep -oP 'role/\K[^/]+')
echo "  Role: ${ROLE_NAME}"
echo ""

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "  Account ID: ${ACCOUNT_ID}"
echo ""

# Check current policies
echo -e "${YELLOW}[2/4] Checking current policies...${NC}"
INLINE_POLICIES=$(aws iam list-role-policies --role-name "${ROLE_NAME}" --region "${AWS_REGION}" --query 'PolicyNames' --output json)
echo "  Inline policies: ${INLINE_POLICIES}"
echo ""

# Create Secrets Manager policy
echo -e "${YELLOW}[3/4] Creating Secrets Manager access policy...${NC}"
POLICY_NAME="warmpawz-prod-lambda-secrets-manager-$(date +%s)"

POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:warmpawz-prod-*",
        "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:warmpawz/prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# Check if policy already exists
EXISTING_POLICY=$(aws iam get-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --region "${AWS_REGION}" 2>&1) || {
  # Policy doesn't exist, create it
  echo "  Creating new policy: ${POLICY_NAME}"
  aws iam put-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-name "${POLICY_NAME}" \
    --policy-document "${POLICY_DOCUMENT}" \
    --region "${AWS_REGION}" || {
    echo -e "${RED}❌ Failed to create policy${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Policy created successfully${NC}"
}

# Also attach AWS managed policy for Secrets Manager (if not already attached)
echo -e "${YELLOW}[4/4] Checking for AWS managed Secrets Manager policy...${NC}"
ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name "${ROLE_NAME}" --region "${AWS_REGION}" --query 'AttachedPolicies[*].PolicyArn' --output json)

if echo "$ATTACHED_POLICIES" | grep -q "SecretsManagerReadWrite"; then
  echo -e "${GREEN}✅ Secrets Manager policy already attached${NC}"
else
  echo "  Attaching AWS managed Secrets Manager policy..."
  aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/SecretsManagerReadWrite" \
    --region "${AWS_REGION}" || {
    echo -e "${YELLOW}⚠️  Could not attach managed policy (may need manual attachment)${NC}"
    echo "  Policy ARN: arn:aws:iam::aws:policy/SecretsManagerReadWrite"
  } && {
    echo -e "${GREEN}✅ Managed policy attached${NC}"
  }
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Secrets Manager Access Fixed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Wait 10-30 seconds for IAM changes to propagate"
echo "2. Test the health endpoint:"
echo "   curl -X GET 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health'"
echo ""
echo "3. Monitor logs:"
echo "   aws logs tail /aws/lambda/${LAMBDA_FUNCTION_NAME} --follow --region ${AWS_REGION}"
echo ""

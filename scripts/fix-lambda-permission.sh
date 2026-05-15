#!/bin/bash
# =============================================================================
# Fix Lambda permission denied issues via AWS CLI
# =============================================================================
# Run with AWS credentials that have:
#   lambda:GetFunction, lambda:GetPolicy, lambda:AddPermission
#   iam:GetRole, iam:PutRolePolicy, iam:GetRolePolicy
#   sts:GetCallerIdentity
# =============================================================================

set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-api-dev-api}"
# API Gateway IDs that may invoke this Lambda (from config/urls.json)
API_IDS="${API_GATEWAY_IDS:-z0b3obweb6,rrg9107m3d}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "Region: $AWS_REGION  Lambda: $LAMBDA_FUNCTION_NAME"
echo ""

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || {
  echo -e "${RED}Failed to get AWS account ID. Check credentials (aws sts get-caller-identity).${NC}"
  exit 1
}
echo -e "${GREEN}Account: $ACCOUNT_ID${NC}"

# Get Lambda config and role ARN
LAMBDA_ROLE_ARN=$(aws lambda get-function \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query 'Configuration.Role' \
  --output text 2>/dev/null) || {
  echo -e "${RED}Failed to get Lambda function. Is the name correct? (use LAMBDA_FUNCTION_NAME=... if needed)${NC}"
  exit 1
}
ROLE_NAME="${LAMBDA_ROLE_ARN#*/}"
echo -e "${GREEN}Lambda role: $ROLE_NAME${NC}"

# Inline policy: Secrets Manager (warmpawz/*), Bedrock (Nova), Textract
# Use this if your Lambda role was created outside CDK or is missing these.
POLICY_DOCUMENT=$(cat <<'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerWarmpawz",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:CreateSecret"
      ],
      "Resource": "arn:aws:secretsmanager:REGION_PLACEHOLDER:ACCOUNT_PLACEHOLDER:secret:warmpawz/*"
    },
    {
      "Sid": "BedrockNova",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:REGION_PLACEHOLDER::foundation-model/amazon.nova-lite-v1*",
        "arn:aws:bedrock:us-east-1::foundation-model/us.amazon.nova-lite-v1*"
      ]
    },
    {
      "Sid": "Textract",
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument"
      ],
      "Resource": "*"
    }
  ]
}
POLICY
)
POLICY_DOCUMENT="${POLICY_DOCUMENT//REGION_PLACEHOLDER/$AWS_REGION}"
POLICY_DOCUMENT="${POLICY_DOCUMENT//ACCOUNT_PLACEHOLDER/$ACCOUNT_ID}"

echo ""
echo -e "${YELLOW}Attaching inline policy WarmpawzLambdaFix to role $ROLE_NAME...${NC}"
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "WarmpawzLambdaFix" \
  --policy-document "$POLICY_DOCUMENT" \
  && echo -e "${GREEN}Inline policy attached.${NC}" \
  || echo -e "${RED}Failed to attach inline policy (role may be immutable or missing iam:PutRolePolicy).${NC}"

# Add API Gateway permission to invoke Lambda (if missing)
for API_ID in ${API_IDS//,/ }; do
  SID="apigateway-invoke-${API_ID}"
  echo ""
  echo -e "${YELLOW}Adding Lambda invoke permission for API Gateway $API_ID (statement-id: $SID)...${NC}"
  aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --statement-id "$SID" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    --region "$AWS_REGION" 2>/dev/null && echo -e "${GREEN}Permission added for $API_ID.${NC}" || {
      if aws lambda get-policy --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" 2>/dev/null | grep -q "$SID"; then
        echo -e "${GREEN}Permission for $API_ID already exists.${NC}"
      else
        echo -e "${RED}Failed to add permission for $API_ID.${NC}"
      fi
    }
done

echo ""
echo -e "${GREEN}Done. If Lambda still returns permission denied:${NC}"
echo "  1. Confirm the execution role is $ROLE_NAME and has the new inline policy."
echo "  2. Check CloudWatch Logs for the exact AccessDenied action (e.g. secretsmanager:GetSecretValue)."
echo "  3. If you use CDK, run 'cd infrastructure/cdk && npx cdk deploy' to sync IAM from iam-stack.ts."

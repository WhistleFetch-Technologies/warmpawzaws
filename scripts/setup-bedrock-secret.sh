#!/bin/bash
# ============================================================================
# SETUP AWS BEDROCK SECRET IN AWS SECRETS MANAGER
# ============================================================================
# Creates/updates the bedrock secret for AI chatbot. Lambda reads warmpawz/{stage}/bedrock.
# Uses ap-south-1 by default (Bedrock available in Mumbai). Lambda can use IAM role (no keys).
#
# Usage (IAM role - Lambda uses its execution role for Bedrock):
#   ./scripts/setup-bedrock-secret.sh --iam dev
#   ./scripts/setup-bedrock-secret.sh --iam prod
#
# Usage (explicit credentials stored in secret):
#   ./scripts/setup-bedrock-secret.sh <access-key-id> <secret-access-key> [region] [model-id] [stage]
#
# Examples:
#   ./scripts/setup-bedrock-secret.sh --iam dev
#   ./scripts/setup-bedrock-secret.sh AKIA... xyz123 ap-south-1 dev
#   ./scripts/setup-bedrock-secret.sh AKIA... xyz123 ap-south-1 anthropic.claude-3-haiku-20240307-v1:0 prod
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REGION=${AWS_REGION:-ap-south-1}
# Defaults: ap-south-1 (Mumbai), amazon.nova-lite-v1:0 (available in ap-south-1)
BEDROCK_REGION="${3:-ap-south-1}"
MODEL_ID="${4:-amazon.nova-lite-v1:0}"
STAGE="${5:-dev}"

# --iam: create secret with only region + modelId (Lambda uses IAM role)
if [ "${1:-}" = "--iam" ]; then
  STAGE="${2:-dev}"
  SECRET_NAME="warmpawz/${STAGE}/bedrock"
  if command -v jq &>/dev/null; then
    SECRET_JSON=$(jq -n --arg r "$BEDROCK_REGION" --arg m "$MODEL_ID" '{ region: $r, modelId: $m, enabled: true }')
  else
    SECRET_JSON="{\"region\":\"$BEDROCK_REGION\",\"modelId\":\"$MODEL_ID\",\"enabled\":true}"
  fi
  echo -e "${BLUE}📦 Creating Bedrock secret (IAM role) for $STAGE in $REGION${NC}"
  if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
    aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$SECRET_JSON" --region "$REGION" >/dev/null
    echo -e "${GREEN}✅ Secret updated. Lambda will use IAM role for Bedrock in ap-south-1.${NC}"
  else
    aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string "$SECRET_JSON" \
      --description "Bedrock config for Warmpawz AI chatbot (${STAGE}), IAM role" --region "$REGION" >/dev/null
    echo -e "${GREEN}✅ Secret created. Lambda will use IAM role for Bedrock in ap-south-1.${NC}"
  fi
  echo ""
  exit 0
fi

if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  IAM role (recommended): $0 --iam [dev|prod]"
  echo -e "  With credentials:       $0 <access-key-id> <secret-access-key> [region] [model-id] [stage]"
  echo -e "${YELLOW}Example (ap-south-1): $0 --iam dev${NC}"
  echo -e "${YELLOW}Example (with keys):   $0 AKIA... your-secret-key ap-south-1 amazon.nova-lite-v1:0 dev${NC}"
  exit 1
fi

ACCESS_KEY_ID="$1"
SECRET_ACCESS_KEY="$2"
SECRET_NAME="warmpawz/${STAGE}/bedrock"

if command -v jq &>/dev/null; then
  SECRET_JSON=$(jq -n \
    --arg ak "$ACCESS_KEY_ID" \
    --arg sk "$SECRET_ACCESS_KEY" \
    --arg r "$BEDROCK_REGION" \
    --arg m "$MODEL_ID" \
    '{ accessKeyId: $ak, secretAccessKey: $sk, region: $r, modelId: $m, enabled: true }')
else
  SECRET_JSON="{\"accessKeyId\":\"$ACCESS_KEY_ID\",\"secretAccessKey\":\"$SECRET_ACCESS_KEY\",\"region\":\"$BEDROCK_REGION\",\"modelId\":\"$MODEL_ID\",\"enabled\":true}"
fi

echo -e "${BLUE}📦 Bedrock secret: $SECRET_NAME (Secrets Manager region $REGION)${NC}"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
  echo -e "${GREEN}✅ Secret exists, updating...${NC}"
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --region "$REGION" > /dev/null
  echo -e "${GREEN}✅ Secret updated${NC}"
else
  echo -e "${BLUE}📦 Creating secret...${NC}"
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --description "AWS Bedrock credentials and model for Warmpawz AI chatbot (${STAGE})" \
    --region "$REGION" > /dev/null
  echo -e "${GREEN}✅ Secret created${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ BEDROCK SECRET SETUP COMPLETE                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "   Secret: ${SECRET_NAME}"
echo -e "   Bedrock region: ${BEDROCK_REGION} (ap-south-1 = Mumbai)"
echo -e "   Model: ${MODEL_ID}"
echo -e "   Stage: ${STAGE}"
echo ""
echo -e "🧪 Lambda will use this for /ai-chatbot/chat, symptoms-checker, and booking-assist."
echo ""

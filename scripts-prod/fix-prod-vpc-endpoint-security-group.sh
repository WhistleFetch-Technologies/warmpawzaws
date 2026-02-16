#!/bin/bash

# ============================================================================
# Fix VPC Endpoint Security Group for Lambda Access
# ============================================================================
# Ensures Lambda can access Secrets Manager via VPC endpoint
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VPC_ENDPOINT_ID="${VPC_ENDPOINT_ID:-vpce-003f107655f4111c1}"
LAMBDA_SG_ID="${LAMBDA_SG_ID:-sg-02e65cf9ab59ae60b}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fix VPC Endpoint Security Group${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get VPC endpoint security group
echo -e "${YELLOW}[1/3] Getting VPC endpoint security group...${NC}"
VPC_ENDPOINT_SG=$(aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids "${VPC_ENDPOINT_ID}" \
  --region "${AWS_REGION}" \
  --query 'VpcEndpoints[0].Groups[0].GroupId' \
  --output text)

echo "  VPC Endpoint Security Group: ${VPC_ENDPOINT_SG}"
echo "  Lambda Security Group: ${LAMBDA_SG_ID}"
echo ""

# Check current rules
echo -e "${YELLOW}[2/3] Checking current security group rules...${NC}"
CURRENT_RULES=$(aws ec2 describe-security-groups \
  --group-ids "${VPC_ENDPOINT_SG}" \
  --region "${AWS_REGION}" \
  --query "SecurityGroups[0].IpPermissions[?UserIdGroupPairs[?GroupId=='${LAMBDA_SG_ID}']]" \
  --output json)

if echo "$CURRENT_RULES" | grep -q "${LAMBDA_SG_ID}"; then
  echo -e "${GREEN}✅ Lambda security group already allowed${NC}"
else
  echo -e "${YELLOW}⚠️  Lambda security group not found in VPC endpoint rules${NC}"
  echo "  Adding rule..."
  
  # Add rule to allow Lambda SG to access VPC endpoint
  aws ec2 authorize-security-group-ingress \
    --group-id "${VPC_ENDPOINT_SG}" \
    --protocol tcp \
    --port 443 \
    --source-group "${LAMBDA_SG_ID}" \
    --region "${AWS_REGION}" || {
    echo -e "${RED}❌ Failed to add security group rule${NC}"
    exit 1
  }
  
  echo -e "${GREEN}✅ Security group rule added${NC}"
fi
echo ""

# Verify
echo -e "${YELLOW}[3/3] Verifying configuration...${NC}"
VERIFY_RULES=$(aws ec2 describe-security-groups \
  --group-ids "${VPC_ENDPOINT_SG}" \
  --region "${AWS_REGION}" \
  --query "SecurityGroups[0].IpPermissions[?UserIdGroupPairs[?GroupId=='${LAMBDA_SG_ID}']]" \
  --output json)

if echo "$VERIFY_RULES" | grep -q "${LAMBDA_SG_ID}"; then
  echo -e "${GREEN}✅ Verification passed! Lambda can now access Secrets Manager${NC}"
else
  echo -e "${RED}❌ Verification failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ VPC Endpoint Security Group Fixed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Wait 10-30 seconds for changes to propagate"
echo "2. Test the health endpoint:"
echo "   curl -X GET 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health'"
echo ""
echo "3. Monitor logs:"
echo "   aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow --region ${AWS_REGION}"
echo ""

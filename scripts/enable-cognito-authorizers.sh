#!/bin/bash

# ============================================================================
# ENABLE COGNITO AUTHORIZERS SCRIPT
# ============================================================================
# Helper script to enable Cognito JWT authorizers on API Gateway
# Date: 2026-01-02
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Cognito Authorizer Enablement Script${NC}"
echo ""
echo "This script helps enable Cognito JWT authorizers on API Gateway."
echo "For detailed instructions, see: docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Configure AWS credentials: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"
echo ""

# Get API Gateway ID
echo "Finding API Gateway..."
API_ID=$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='warmpawz-prod-api' || Name=='warmpawz-dev-api'].ApiId" \
  --output text \
  --region ap-south-1 | head -1)

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
    echo -e "${YELLOW}⚠️  API Gateway not found${NC}"
    echo "Please provide API Gateway ID:"
    read -p "API Gateway ID: " API_ID
else
    echo -e "${GREEN}✅ Found API Gateway: $API_ID${NC}"
fi

echo ""

# Get Cognito User Pool IDs
echo "Finding Cognito User Pools..."
CUSTOMER_POOL=$(aws cognito-idp list-user-pools \
  --max-results 10 \
  --region ap-south-1 \
  --query "UserPools[?contains(Name, 'customer') || contains(Name, 'Customer')].Id" \
  --output text | head -1)

VENDOR_POOL=$(aws cognito-idp list-user-pools \
  --max-results 10 \
  --region ap-south-1 \
  --query "UserPools[?contains(Name, 'vendor') || contains(Name, 'Vendor')].Id" \
  --output text | head -1)

ADMIN_POOL=$(aws cognito-idp list-user-pools \
  --max-results 10 \
  --region ap-south-1 \
  --query "UserPools[?contains(Name, 'admin') || contains(Name, 'Admin')].Id" \
  --output text | head -1)

echo ""
echo "Cognito User Pools:"
echo "  Customer: ${CUSTOMER_POOL:-Not found}"
echo "  Vendor: ${VENDOR_POOL:-Not found}"
echo "  Admin: ${ADMIN_POOL:-Not found}"
echo ""

# Check existing authorizers
echo "Checking existing authorizers..."
EXISTING_AUTH=$(aws apigatewayv2 get-authorizers \
  --api-id "$API_ID" \
  --region ap-south-1 \
  --query 'Items[*].[Name,AuthorizerId]' \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_AUTH" ]; then
    echo -e "${GREEN}✅ Existing authorizers found:${NC}"
    echo "$EXISTING_AUTH"
else
    echo -e "${YELLOW}⚠️  No authorizers found${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Review detailed guide:"
echo "   cat docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md"
echo ""
echo "2. Enable authorizers via CDK (Recommended):"
echo "   cd infrastructure/cdk"
echo "   npm run cdk deploy ApiGatewayStack -- --context environment=prod"
echo ""
echo "3. Or enable manually via AWS CLI (see guide for commands)"
echo ""
echo "4. Test authentication:"
echo "   curl -X GET https://api.warmpawz.com/admin/roles"
echo "   # Should return 401 Unauthorized without token"
echo ""

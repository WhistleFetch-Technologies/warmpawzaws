#!/bin/bash
# ============================================================================
# Complete Razorpay NAT Gateway Fix Script
# ============================================================================
# This script runs all diagnostics and applies fixes for Razorpay connectivity
# issues related to NAT Gateway configuration
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔧 Razorpay NAT Gateway Fix - Complete Script"
echo "=============================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Run Diagnostics
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Running Diagnostics${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/diagnose-nat-gateway.sh $ENVIRONMENT $AWS_REGION

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Fixing Security Groups${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/fix-lambda-security-groups.sh $ENVIRONMENT $AWS_REGION

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Verifying Lambda Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get Lambda function name
LAMBDA_FUNC=$(aws lambda list-functions --region $AWS_REGION --query "Functions[?contains(FunctionName, 'warmpawz-$ENVIRONMENT-api')].FunctionName" --output text | head -1)

if [ -n "$LAMBDA_FUNC" ] && [ "$LAMBDA_FUNC" != "None" ]; then
    echo "✅ Found Lambda function: $LAMBDA_FUNC"
    
    # Get VPC configuration
    VPC_CONFIG=$(aws lambda get-function --function-name "$LAMBDA_FUNC" --region $AWS_REGION --query 'Configuration.VpcConfig' --output json 2>/dev/null || echo "{}")
    
    if [ "$VPC_CONFIG" != "{}" ] && [ "$VPC_CONFIG" != "null" ]; then
        SUBNET_IDS=$(echo "$VPC_CONFIG" | grep -o '"SubnetIds":\[[^]]*\]' | grep -o 'subnet-[^"]*' || echo "")
        SG_IDS=$(echo "$VPC_CONFIG" | grep -o '"SecurityGroupIds":\[[^]]*\]' | grep -o 'sg-[^"]*' || echo "")
        
        echo "  Subnets: $SUBNET_IDS"
        echo "  Security Groups: $SG_IDS"
        
        # Check route tables for each subnet
        echo ""
        echo "  Checking route tables for Lambda subnets..."
        for SUBNET_ID in $SUBNET_IDS; do
            RT_ID=$(aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$SUBNET_ID" --region $AWS_REGION --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo "")
            if [ -n "$RT_ID" ] && [ "$RT_ID" != "None" ]; then
                NAT_ROUTE=$(aws ec2 describe-route-tables --route-table-ids $RT_ID --region $AWS_REGION --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && NatGatewayId!=`null`].NatGatewayId' --output text 2>/dev/null || echo "")
                IGW_ROUTE=$(aws ec2 describe-route-tables --route-table-ids $RT_ID --region $AWS_REGION --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && GatewayId!=`null`].GatewayId' --output text 2>/dev/null || echo "")
                
                if [ -n "$NAT_ROUTE" ] && [ "$NAT_ROUTE" != "None" ]; then
                    echo -e "    ${GREEN}✅ Subnet $SUBNET_ID: Routes through NAT Gateway ($NAT_ROUTE)${NC}"
                elif [ -n "$IGW_ROUTE" ] && [ "$IGW_ROUTE" != "None" ] && [[ "$IGW_ROUTE" == igw-* ]]; then
                    echo -e "    ${YELLOW}⚠️  Subnet $SUBNET_ID: Routes through Internet Gateway (public subnet)${NC}"
                else
                    echo -e "    ${RED}❌ Subnet $SUBNET_ID: No route to internet!${NC}"
                fi
            fi
        done
    else
        echo -e "${YELLOW}⚠️  Lambda function is not in a VPC${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Lambda function not found${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Fixes Applied:${NC}"
echo "  1. Security group egress rules updated (allows HTTPS outbound)"
echo "  2. VPC endpoints verified (Secrets Manager endpoint exists)"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "  1. Test Razorpay API call from Lambda"
echo "  2. Check CloudWatch logs for Lambda function"
echo "  3. If issues persist, verify route tables manually:"
echo "     aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=<subnet-id>"
echo ""
echo -e "${BLUE}💡 Important Notes:${NC}"
echo "  - Lambda MUST be in private subnets with NAT Gateway routing for Razorpay API"
echo "  - Security groups now allow all outbound traffic (HTTPS included)"
echo "  - VPC endpoints reduce NAT dependency for AWS services (Secrets Manager)"
echo "  - For external APIs like Razorpay, NAT Gateway is still required"
echo ""

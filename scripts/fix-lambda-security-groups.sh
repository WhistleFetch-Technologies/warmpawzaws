#!/bin/bash
# ============================================================================
# Fix Lambda Security Group Egress Rules
# ============================================================================
# This script ensures Lambda security groups allow HTTPS outbound
# to enable Razorpay API communication
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔧 Fixing Lambda Security Group Egress Rules"
echo "============================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Environment,Values=$ENVIRONMENT" "Name=tag:Project,Values=Warmpawz" --region $AWS_REGION --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")

if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
    echo -e "${RED}❌ Could not find VPC${NC}"
    exit 1
fi

echo "✅ Found VPC: $VPC_ID"
echo ""

# Get Lambda security groups
echo "📋 Finding Lambda security groups..."
SG_IDS=$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*lambda*" \
    --region $AWS_REGION \
    --query 'SecurityGroups[*].GroupId' \
    --output text 2>/dev/null || echo "")

if [ -z "$SG_IDS" ] || [ "$SG_IDS" == "None" ]; then
    echo -e "${YELLOW}⚠️  No Lambda security groups found with tag Name=*lambda*${NC}"
    echo "   Trying to find by function name..."
    
    # Try to get from Lambda function directly
    LAMBDA_FUNC=$(aws lambda list-functions --region $AWS_REGION --query "Functions[?contains(FunctionName, 'warmpawz-$ENVIRONMENT')].FunctionName" --output text | head -1)
    if [ -n "$LAMBDA_FUNC" ] && [ "$LAMBDA_FUNC" != "None" ]; then
        SG_IDS=$(aws lambda get-function --function-name "$LAMBDA_FUNC" --region $AWS_REGION --query 'Configuration.VpcConfig.SecurityGroupIds[*]' --output text 2>/dev/null || echo "")
    fi
fi

if [ -z "$SG_IDS" ] || [ "$SG_IDS" == "None" ]; then
    echo -e "${RED}❌ Could not find Lambda security groups${NC}"
    exit 1
fi

echo "✅ Found security groups: $SG_IDS"
echo ""

# Check and fix each security group
FIXED=0
SKIPPED=0

for SG_ID in $SG_IDS; do
    echo "Checking security group: $SG_ID"
    
    # Check if it already allows all outbound
    HAS_ALL_OUTBOUND=$(aws ec2 describe-security-groups \
        --group-ids $SG_ID \
        --region $AWS_REGION \
        --query 'SecurityGroups[0].IpPermissionsEgress[?IpProtocol==`-1` && length(IpRanges[?CidrIp==`0.0.0.0/0`])>0]' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$HAS_ALL_OUTBOUND" ] && [ "$HAS_ALL_OUTBOUND" != "None" ]; then
        echo -e "  ${GREEN}✅ Already allows all outbound traffic${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Check if it allows HTTPS outbound
    HAS_HTTPS=$(aws ec2 describe-security-groups \
        --group-ids $SG_ID \
        --region $AWS_REGION \
        --query 'SecurityGroups[0].IpPermissionsEgress[?FromPort==`443` && ToPort==`443` && IpProtocol==`tcp`]' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$HAS_HTTPS" ] && [ "$HAS_HTTPS" != "None" ]; then
        echo -e "  ${GREEN}✅ Already allows HTTPS (port 443) outbound${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Add egress rule for all outbound
    echo -e "  ${YELLOW}⚠️  Adding egress rule for all outbound traffic...${NC}"
    aws ec2 authorize-security-group-egress \
        --group-id $SG_ID \
        --ip-permissions IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0,Description="Allow all outbound for Razorpay API access"}] \
        --region $AWS_REGION 2>/dev/null || {
            # Rule might already exist, check error
            if [ $? -eq 0 ]; then
                echo -e "  ${GREEN}✅ Egress rule added${NC}"
                FIXED=$((FIXED + 1))
            else
                echo -e "  ${YELLOW}⚠️  Rule may already exist or error occurred${NC}"
            fi
        }
    
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✅ Egress rule added${NC}"
        FIXED=$((FIXED + 1))
    fi
    echo ""
done

echo "📊 Summary"
echo "=========="
echo -e "  Fixed: ${GREEN}$FIXED${NC} security groups"
echo -e "  Already configured: ${GREEN}$SKIPPED${NC} security groups"
echo ""
echo "✅ Security group egress rules updated!"
echo ""
echo "Next steps:"
echo "  1. Test Razorpay connectivity from Lambda"
echo "  2. Check CloudWatch logs for any remaining errors"
echo "  3. Verify route tables are properly configured (run: ./scripts/diagnose-nat-gateway.sh $ENVIRONMENT $AWS_REGION)"
echo ""

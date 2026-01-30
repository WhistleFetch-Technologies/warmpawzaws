#!/bin/bash
# ============================================================================
# NAT GATEWAY DIAGNOSTIC SCRIPT
# ============================================================================
# This script helps diagnose NAT gateway routing issues that prevent
# Lambda functions from reaching external APIs like Razorpay
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔍 NAT Gateway Diagnostic Script"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Get VPC ID from SSM or environment
VPC_ID=$(aws ssm get-parameter --name "/warmpawz/$ENVIRONMENT/vpc/vpcId" --region $AWS_REGION --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "$VPC_ID" ]; then
  echo "❌ Could not find VPC ID in SSM parameter /warmpawz/$ENVIRONMENT/vpc/vpcId"
  echo "   Trying to find VPC by tag..."
  VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Environment,Values=$ENVIRONMENT" "Name=tag:Project,Values=Warmpawz" --region $AWS_REGION --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")
fi

if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
  echo "❌ Could not find VPC. Please provide VPC ID manually."
  exit 1
fi

echo "✅ Found VPC: $VPC_ID"
echo ""

# 1. Check NAT Gateways
echo "📋 Step 1: Checking NAT Gateways"
echo "-----------------------------------"
NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" --region $AWS_REGION --query 'NatGateways[*].[NatGatewayId,SubnetId,State]' --output table 2>/dev/null || echo "")

if [ -z "$NAT_GATEWAYS" ] || [ "$NAT_GATEWAYS" == "None" ]; then
  echo "❌ No NAT Gateways found in VPC $VPC_ID"
  echo "   This will prevent Lambda functions in private subnets from accessing the internet."
  echo "   Solution: Create a NAT Gateway in a public subnet."
else
  echo "$NAT_GATEWAYS"
  echo "✅ NAT Gateway(s) found"
fi
echo ""

# 2. Check Private Subnets
echo "📋 Step 2: Checking Private Subnets"
echo "-------------------------------------"
PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=private" --region $AWS_REGION --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone]' --output table 2>/dev/null || echo "")

if [ -z "$PRIVATE_SUBNETS" ] || [ "$PRIVATE_SUBNETS" == "None" ]; then
  echo "⚠️  No private subnets found with tag Type=private"
  echo "   Checking all subnets in VPC..."
  PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone]' --output table 2>/dev/null || echo "")
fi

if [ -n "$PRIVATE_SUBNETS" ] && [ "$PRIVATE_SUBNETS" != "None" ]; then
  echo "$PRIVATE_SUBNETS"
else
  echo "❌ No subnets found in VPC"
fi
echo ""

# 3. Check Route Tables for Private Subnets
echo "📋 Step 3: Checking Route Tables for Private Subnets"
echo "------------------------------------------------------"
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'Subnets[*].SubnetId' --output text 2>/dev/null || echo "")

if [ -n "$SUBNET_IDS" ] && [ "$SUBNET_IDS" != "None" ]; then
  for SUBNET_ID in $SUBNET_IDS; do
    echo "Checking subnet: $SUBNET_ID"
    ROUTE_TABLE=$(aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$SUBNET_ID" --region $AWS_REGION --query 'RouteTables[0]' --output json 2>/dev/null || echo "{}")
    
    if [ "$ROUTE_TABLE" != "{}" ] && [ "$ROUTE_TABLE" != "null" ]; then
      # Use AWS CLI query instead of jq
      ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$SUBNET_ID" --region $AWS_REGION --query 'RouteTables[0].RouteTableId' --output text 2>/dev/null || echo "")
      
      if [ -n "$ROUTE_TABLE_ID" ] && [ "$ROUTE_TABLE_ID" != "None" ]; then
        # Check for NAT Gateway route
        NAT_ROUTE=$(aws ec2 describe-route-tables --route-table-ids $ROUTE_TABLE_ID --region $AWS_REGION --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && NatGatewayId!=`null`].NatGatewayId' --output text 2>/dev/null || echo "")
        
        if [ -n "$NAT_ROUTE" ] && [ "$NAT_ROUTE" != "None" ]; then
          echo "  ✅ Route table $ROUTE_TABLE_ID routes 0.0.0.0/0 through NAT Gateway: $NAT_ROUTE"
        else
          # Check for Internet Gateway route (public subnet)
          IGW_ROUTE=$(aws ec2 describe-route-tables --route-table-ids $ROUTE_TABLE_ID --region $AWS_REGION --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && GatewayId!=`null`].GatewayId' --output text 2>/dev/null || echo "")
          if [ -n "$IGW_ROUTE" ] && [ "$IGW_ROUTE" != "None" ] && [[ "$IGW_ROUTE" == igw-* ]]; then
            echo "  ⚠️  Route table $ROUTE_TABLE_ID routes 0.0.0.0/0 through Internet Gateway (public subnet)"
          else
            echo "  ❌ Route table $ROUTE_TABLE_ID does NOT route 0.0.0.0/0 through NAT Gateway"
            echo "     This will prevent Lambda functions from accessing external APIs like Razorpay"
          fi
        fi
      fi
    else
      echo "  ⚠️  No route table found for subnet $SUBNET_ID"
    fi
  done
else
  echo "❌ Could not retrieve subnet IDs"
fi
echo ""

# 4. Check Lambda Security Groups
echo "📋 Step 4: Checking Lambda Security Groups"
echo "-------------------------------------------"
LAMBDA_SG=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*lambda*" --region $AWS_REGION --query 'SecurityGroups[*].[GroupId,GroupName]' --output table 2>/dev/null || echo "")

if [ -n "$LAMBDA_SG" ] && [ "$LAMBDA_SG" != "None" ]; then
  echo "$LAMBDA_SG"
  echo ""
  echo "Checking egress rules..."
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*lambda*" --region $AWS_REGION --query 'SecurityGroups[*].GroupId' --output text 2>/dev/null); do
    EGRESS=$(aws ec2 describe-security-groups --group-ids $SG_ID --region $AWS_REGION --query 'SecurityGroups[0].IpPermissionsEgress[*].[IpProtocol,FromPort,ToPort]' --output table 2>/dev/null || echo "")
    if echo "$EGRESS" | grep -q "0.0.0.0/0"; then
      echo "  ✅ Security group $SG_ID allows all outbound traffic"
    else
      echo "  ⚠️  Security group $SG_ID may have restricted egress rules"
    fi
  done
else
  echo "⚠️  No Lambda security groups found"
fi
echo ""

# 5. Check VPC Endpoints
echo "📋 Step 5: Checking VPC Endpoints (for Secrets Manager)"
echo "--------------------------------------------------------"
VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=com.amazonaws.$AWS_REGION.secretsmanager" --region $AWS_REGION --query 'VpcEndpoints[*].[VpcEndpointId,State,ServiceName]' --output table 2>/dev/null || echo "")

if [ -n "$VPC_ENDPOINTS" ] && [ "$VPC_ENDPOINTS" != "None" ]; then
  echo "$VPC_ENDPOINTS"
  echo "✅ VPC Endpoint for Secrets Manager found (reduces NAT dependency)"
else
  echo "⚠️  No VPC Endpoint for Secrets Manager found"
  echo "   Lambda will need NAT Gateway to access Secrets Manager"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo ""
echo "Common Issues and Solutions:"
echo ""
echo "1. ❌ No NAT Gateway:"
echo "   → Create NAT Gateway in a public subnet"
echo "   → Associate private subnet route tables to route 0.0.0.0/0 through NAT"
echo ""
echo "2. ❌ Route Table Not Configured:"
echo "   → Ensure private subnets have route tables that route 0.0.0.0/0 through NAT Gateway"
echo "   → Check: aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=<subnet-id>"
echo ""
echo "3. ⚠️  Security Group Restrictions:"
echo "   → Ensure Lambda security group allows HTTPS (port 443) outbound"
echo "   → Or allow all outbound (0.0.0.0/0)"
echo ""
echo "4. ✅ VPC Endpoints:"
echo "   → Create VPC endpoints for Secrets Manager to avoid NAT dependency"
echo "   → This reduces costs and improves security"
echo ""
echo "For Razorpay API access (api.razorpay.com), Lambda MUST have:"
echo "  - NAT Gateway configured in VPC"
echo "  - Private subnet route tables routing 0.0.0.0/0 through NAT Gateway"
echo "  - Security group allowing HTTPS outbound"
echo ""

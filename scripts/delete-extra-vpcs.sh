#!/bin/bash

# Delete Extra VPCs (keeping only the one with RDS)
# RDS is in vpc-02a4893e5e582c4d8

set -e

REGION="ap-south-1"
RDS_VPC="vpc-02a4893e5e582c4d8"

echo "🗑️  DELETING EXTRA VPCs (keeping $RDS_VPC where RDS lives)"
echo ""

# VPCs to delete
VPCS_TO_DELETE=(
  "vpc-0d6497f6ffbe40994"
  "vpc-0c8567a5b023145f2"
  "vpc-004b0b8fa26c28ab4"
)

for VPC_ID in "${VPCS_TO_DELETE[@]}"; do
  echo "════════════════════════════════════════════════════════════"
  echo "🗑️  Deleting VPC: $VPC_ID"
  echo "════════════════════════════════════════════════════════════"
  
  # 1. Delete NAT Gateways (takes time)
  echo "1️⃣  Deleting NAT Gateways..."
  NAT_IDS=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available,pending" --region $REGION --query 'NatGateways[*].NatGatewayId' --output text 2>/dev/null || echo "")
  for NAT_ID in $NAT_IDS; do
    echo "   Deleting NAT Gateway: $NAT_ID"
    aws ec2 delete-nat-gateway --nat-gateway-id "$NAT_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  if [ -n "$NAT_IDS" ]; then
    echo "   Waiting 30s for NAT Gateway deletion..."
    sleep 30
  fi
  
  # 2. Release Elastic IPs
  echo "2️⃣  Releasing Elastic IPs..."
  EIP_IDS=$(aws ec2 describe-addresses --filters "Name=domain,Values=vpc" --region $REGION --query "Addresses[?AssociationId==null].AllocationId" --output text 2>/dev/null || echo "")
  for EIP_ID in $EIP_IDS; do
    echo "   Releasing EIP: $EIP_ID"
    aws ec2 release-address --allocation-id "$EIP_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  
  # 3. Delete Internet Gateway
  echo "3️⃣  Deleting Internet Gateway..."
  IGW_ID=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --region $REGION --query 'InternetGateways[0].InternetGatewayId' --output text 2>/dev/null || echo "")
  if [ -n "$IGW_ID" ] && [ "$IGW_ID" != "None" ]; then
    echo "   Detaching IGW: $IGW_ID"
    aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region $REGION 2>&1 || echo "   Failed"
    echo "   Deleting IGW: $IGW_ID"
    aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID" --region $REGION 2>&1 || echo "   Failed"
  fi
  
  # 4. Delete VPC Endpoints
  echo "4️⃣  Deleting VPC Endpoints..."
  VPCE_IDS=$(aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'VpcEndpoints[*].VpcEndpointId' --output text 2>/dev/null || echo "")
  for VPCE_ID in $VPCE_IDS; do
    echo "   Deleting VPC Endpoint: $VPCE_ID"
    aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$VPCE_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  
  # 5. Delete Subnets
  echo "5️⃣  Deleting Subnets..."
  SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'Subnets[*].SubnetId' --output text 2>/dev/null || echo "")
  for SUBNET_ID in $SUBNET_IDS; do
    echo "   Deleting Subnet: $SUBNET_ID"
    aws ec2 delete-subnet --subnet-id "$SUBNET_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  
  # 6. Delete Route Tables (except main)
  echo "6️⃣  Deleting Route Tables..."
  RT_IDS=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text 2>/dev/null || echo "")
  for RT_ID in $RT_IDS; do
    echo "   Deleting Route Table: $RT_ID"
    aws ec2 delete-route-table --route-table-id "$RT_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  
  # 7. Delete Security Groups (except default)
  echo "7️⃣  Deleting Security Groups..."
  SG_IDS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")
  for SG_ID in $SG_IDS; do
    echo "   Deleting Security Group: $SG_ID"
    aws ec2 delete-security-group --group-id "$SG_ID" --region $REGION 2>&1 || echo "   Failed"
  done
  
  # 8. Delete VPC
  echo "8️⃣  Deleting VPC..."
  aws ec2 delete-vpc --vpc-id "$VPC_ID" --region $REGION 2>&1 && echo "   ✅ VPC deleted" || echo "   ❌ VPC deletion failed"
  
  echo ""
done

echo "════════════════════════════════════════════════════════════"
echo "✅ CLEANUP COMPLETE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Remaining VPCs:"
aws ec2 describe-vpcs --region $REGION --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0],IsDefault]' --output table


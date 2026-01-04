#!/bin/bash

# Cleanup Orphaned Resources in VPC
# Keep only resources actually in use

set -e

REGION="ap-south-1"
VPC_ID="vpc-02a4893e5e582c4d8"

echo "🧹 CLEANING UP ORPHANED RESOURCES"
echo "VPC: $VPC_ID"
echo ""

# 1. Find NAT Gateway in use (the one with associations)
echo "1️⃣ Finding NAT Gateway in use..."
NAT_IN_USE=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" --region $REGION --query 'NatGateways[0].NatGatewayId' --output text 2>/dev/null | head -1)
echo "   NAT Gateway in use: $NAT_IN_USE"

# 2. Delete duplicate NAT Gateways
echo ""
echo "2️⃣ Deleting duplicate NAT Gateways..."
NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" --region $REGION --query 'NatGateways[*].NatGatewayId' --output text 2>/dev/null || echo "")
for NAT_ID in $NAT_GATEWAYS; do
  if [ "$NAT_ID" != "$NAT_IN_USE" ] && [ "$NAT_ID" != "None" ]; then
    echo "   Deleting duplicate NAT Gateway: $NAT_ID"
    aws ec2 delete-nat-gateway --nat-gateway-id "$NAT_ID" --region $REGION 2>&1 || echo "   Failed"
  fi
done

# 3. Release unused Elastic IPs (keep only the one attached to NAT in use)
echo ""
echo "3️⃣ Releasing unused Elastic IPs..."
if [ -n "$NAT_IN_USE" ] && [ "$NAT_IN_USE" != "None" ]; then
  EIP_IN_USE=$(aws ec2 describe-nat-gateways --nat-gateway-ids "$NAT_IN_USE" --region $REGION --query 'NatGateways[0].NatGatewayAddresses[0].AllocationId' --output text 2>/dev/null || echo "")
  echo "   EIP in use: $EIP_IN_USE"
fi

ALL_EIPS=$(aws ec2 describe-addresses --filters "Name=domain,Values=vpc" --region $REGION --query 'Addresses[*].AllocationId' --output text 2>/dev/null || echo "")
for EIP_ID in $ALL_EIPS; do
  if [ "$EIP_ID" != "$EIP_IN_USE" ] && [ "$EIP_ID" != "None" ]; then
    echo "   Releasing unused EIP: $EIP_ID"
    aws ec2 release-address --allocation-id "$EIP_ID" --region $REGION 2>&1 || echo "   Failed"
  fi
done

# 4. Find route tables in use (those with subnet associations)
echo ""
echo "4️⃣ Finding route tables in use..."
RT_IN_USE=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'RouteTables[?length(Associations[?SubnetId!=`null`]) > `0`].RouteTableId' --output text 2>/dev/null || echo "")
echo "   Route tables in use: $RT_IN_USE"

# 5. Delete duplicate route tables (those without associations and not main)
echo ""
echo "5️⃣ Deleting duplicate route tables..."
ALL_RTS=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'RouteTables[*].RouteTableId' --output text 2>/dev/null || echo "")
for RT_ID in $ALL_RTS; do
  # Check if this RT is in use
  IN_USE=$(echo "$RT_IN_USE" | grep -w "$RT_ID" || echo "")
  if [ -z "$IN_USE" ] && [ "$RT_ID" != "None" ]; then
    # Check if it's the main route table
    IS_MAIN=$(aws ec2 describe-route-tables --route-table-ids "$RT_ID" --region $REGION --query 'RouteTables[0].Associations[?Main==`true`]' --output text 2>/dev/null || echo "")
    if [ -z "$IS_MAIN" ]; then
      echo "   Deleting duplicate route table: $RT_ID"
      aws ec2 delete-route-table --route-table-id "$RT_ID" --region $REGION 2>&1 || echo "   Failed (may have dependencies)"
    fi
  fi
done

echo ""
echo "✅ CLEANUP COMPLETE"
echo ""
echo "Remaining resources:"
echo "EIPs:"
aws ec2 describe-addresses --filters "Name=domain,Values=vpc" --region $REGION --query 'Addresses[*].AllocationId' --output text
echo ""
echo "NAT Gateways:"
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'NatGateways[*].NatGatewayId' --output text
echo ""
echo "Route Tables:"
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'RouteTables[*].RouteTableId' --output text


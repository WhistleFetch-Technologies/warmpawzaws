#!/usr/bin/env bash
# Create a NAT gateway in the prod VPC via AWS CLI, then pass the IDs to Terraform.
# Use when Terraform cannot create the NAT (e.g. subnet was destroyed or wrong VPC).
#
# Prerequisites: AWS CLI configured with credentials for account 057442119249, region ap-south-1.
#
# Usage:
#   1. Get the VPC ID where Lambda lives (same VPC for RDS/Lambda):
#        aws ec2 describe-security-groups --filters "Name=group-name,Values=*lambda*" "Name=tag:Environment,Values=prod" --query 'SecurityGroups[0].VpcId' --output text
#   2. Run this script with that VPC ID:
#        ./scripts/create-prod-nat-gateway.sh vpc-XXXXXXXX
#   3. Add to infra/envs/prod/terraform.tfvars (or pass -var):
#        existing_vpc_id        = "vpc-XXXXXXXX"
#        existing_nat_gateway_id = "nat-XXXXXXXX"
#   4. Run terraform plan / apply from infra/envs/prod.

set -e
REGION="${AWS_REGION:-ap-south-1}"

if [ -z "$1" ]; then
  echo "Usage: $0 <vpc-id>"
  echo "Example: $0 vpc-0abc123def456"
  echo ""
  echo "To find the prod VPC ID (use the one that has your Lambda):"
  echo "  aws ec2 describe-vpcs --filters Name=tag:Name,Values=warmpawz-prod-vpc Name=tag:Environment,Values=prod --query 'Vpcs[0].VpcId' --output text --region $REGION"
  echo "  aws ec2 describe-security-groups --filters Name=group-name,Values=*lambda* Name=tag:Environment,Values=prod --query 'SecurityGroups[0].VpcId' --output text --region $REGION"
  exit 1
fi

VPC_ID="$1"

# Get first public subnet in this VPC (subnets with tag Type=public or MapPublicIpOnLaunch)
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=public" --query 'Subnets[0].SubnetId' --output text --region "$REGION")
if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "None" ]; then
  SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[0].SubnetId' --output text --region "$REGION")
fi
if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "None" ]; then
  echo "No subnet found in VPC $VPC_ID. Create a public subnet first."
  exit 1
fi

echo "VPC ID:    $VPC_ID"
echo "Subnet ID: $SUBNET_ID"

# Allocate EIP
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --region "$REGION" --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=warmpawz-prod-nat-eip},{Key=Environment,Value=prod}]" --query 'AllocationId' --output text)
echo "EIP Allocation ID: $ALLOC_ID"

# Create NAT gateway
NAT_ID=$(aws ec2 create-nat-gateway --subnet-id "$SUBNET_ID" --allocation-id "$ALLOC_ID" --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=warmpawz-prod-nat},{Key=Environment,Value=prod}]" --region "$REGION" --query 'NatGateway.NatGatewayId' --output text)
echo "NAT Gateway ID: $NAT_ID"

echo ""
echo "Waiting for NAT gateway to become available (1–2 minutes)..."
aws ec2 wait nat-gateway-available --nat-gateway-ids "$NAT_ID" --region "$REGION"
echo "NAT gateway is available."

echo ""
echo "Add to infra/envs/prod/terraform.tfvars (or pass -var at plan/apply):"
echo "  existing_vpc_id         = \"$VPC_ID\""
echo "  existing_nat_gateway_id  = \"$NAT_ID\""
echo ""
echo "Then run from infra/envs/prod:"
echo "  terraform plan -var=\"opensearch_master_password=...\" -var=\"existing_vpc_id=$VPC_ID\" -var=\"existing_nat_gateway_id=$NAT_ID\""
echo "  terraform apply -auto-approve tfplan"

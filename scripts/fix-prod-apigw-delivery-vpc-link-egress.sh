#!/usr/bin/env bash
# Fix API Gateway VPC link → internal delivery ALB 503s on prod.
# Root cause: VPC link SG egress targeted 10.2.0.0/16 while shared VPC is 10.0.0.0/16.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
VPC_ID="${VPC_ID:-vpc-02a4893e5e582c4d8}"
SG_ID="${SG_ID:-sg-05a79cce9e91c6b68}"

VPC_CIDR="$(aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --region "$REGION" --query 'Vpcs[0].CidrBlock' --output text)"
echo "VPC $VPC_ID CIDR: $VPC_CIDR"
echo "Updating egress on $SG_ID (warmpawz-prod-apigw-delivery-vpc-link)..."

# Replace egress: remove wrong 10.2.0.0/16 rule if present, ensure 10.0.0.0/16 (actual VPC).
aws ec2 revoke-security-group-egress \
  --group-id "$SG_ID" \
  --region "$REGION" \
  --ip-permissions "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=10.2.0.0/16,Description=HTTP to internal ALB in VPC}]" \
  2>/dev/null || true

aws ec2 authorize-security-group-egress \
  --group-id "$SG_ID" \
  --region "$REGION" \
  --ip-permissions "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=${VPC_CIDR},Description=HTTP to internal delivery ALB in VPC}]" \
  2>/dev/null || echo "Egress to $VPC_CIDR may already exist."

echo "Done. Smoke test:"
echo "  curl -s -o /dev/null -w '%{http_code}' https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/v3/api-docs"

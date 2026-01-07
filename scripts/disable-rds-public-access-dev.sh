#!/bin/bash
#
# Disable RDS Public Access for Dev Environment
#
# PURPOSE:
#   - Reverts RDS to private-only access
#   - Removes GitHub Actions IP ranges from security group
#
# USAGE:
#   ./scripts/disable-rds-public-access-dev.sh
#

set -e

ENVIRONMENT="dev"
AWS_REGION="ap-south-1"
INSTANCE_IDENTIFIER="warmpawz-${ENVIRONMENT}-instance-1"

echo "🔒 RDS Public Access Disabler for Dev Environment"
echo "=================================================="
echo ""
echo "   This will disable public access to RDS"
echo "   Environment: $ENVIRONMENT"
echo "   Instance: $INSTANCE_IDENTIFIER"
echo ""

read -p "Continue? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "1️⃣  Disabling public accessibility..."
aws rds modify-db-instance \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --no-publicly-accessible \
  --apply-immediately \
  --region "$AWS_REGION" \
  > /dev/null

echo "✅ Modification initiated (will take 3-5 minutes)"

echo ""
echo "2️⃣  Getting security group ID..."
SG_ID=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

echo "   Security Group: $SG_ID"

echo ""
echo "3️⃣  Removing GitHub Actions IP ranges from security group..."

GITHUB_IP_RANGES=(
  "4.175.114.51/32"
  "20.42.134.0/23"
  "20.119.184.0/22"
  "20.119.188.0/23"
  "20.199.39.227/32"
  "20.199.184.0/21"
  "20.200.245.247/32"
  "20.201.28.148/32"
  "20.205.243.160/32"
  "52.147.219.192/26"
)

for IP_RANGE in "${GITHUB_IP_RANGES[@]}"; do
  echo "   Removing: $IP_RANGE"
  aws ec2 revoke-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 5432 \
    --cidr "$IP_RANGE" \
    --region "$AWS_REGION" \
    2>/dev/null && echo "     ✅ Removed" || echo "     ℹ️  Already removed"
done

echo ""
echo "4️⃣  Waiting for RDS instance to be available..."
aws rds wait db-instance-available \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION"

echo "✅ RDS instance is available"

echo ""
echo "=================================================="
echo "✅ RDS Public Access Disabled Successfully"
echo ""
echo "   RDS is now private-only (accessible from VPC only)"
echo ""


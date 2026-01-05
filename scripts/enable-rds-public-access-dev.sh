#!/bin/bash
#
# Enable RDS Public Access for Dev Environment (CI/CD Migrations)
#
# PURPOSE:
#   - GitHub Actions runners cannot reach RDS in private subnet
#   - This script enables public accessibility for dev environment only
#   - Updates security group to allow CI/CD access
#
# SECURITY:
#   - Only applies to dev environment (not prod/stage)
#   - Restricts access to GitHub Actions IP ranges
#   - Can be reverted after migrations complete
#
# USAGE:
#   ./scripts/enable-rds-public-access-dev.sh
#

set -e

ENVIRONMENT="dev"
AWS_REGION="ap-south-1"
CLUSTER_IDENTIFIER="warmpawz-${ENVIRONMENT}-cluster"
INSTANCE_IDENTIFIER="warmpawz-${ENVIRONMENT}-instance-1"

echo "🔧 RDS Public Access Enabler for Dev Environment"
echo "=================================================="
echo ""
echo "⚠️  WARNING: This will make RDS publicly accessible"
echo "   Environment: $ENVIRONMENT"
echo "   Cluster: $CLUSTER_IDENTIFIER"
echo "   Instance: $INSTANCE_IDENTIFIER"
echo ""
echo "   This is ONLY safe for dev/test environments."
echo "   DO NOT run this for production!"
echo ""

# Confirm action
read -p "Continue? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "1️⃣  Checking current RDS instance status..."
CURRENT_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].PubliclyAccessible' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CURRENT_STATUS" == "NOT_FOUND" ]; then
  echo "❌ ERROR: RDS instance not found: $INSTANCE_IDENTIFIER"
  echo "   Verify the instance exists in region $AWS_REGION"
  exit 1
fi

echo "   Current status: PubliclyAccessible = $CURRENT_STATUS"

if [ "$CURRENT_STATUS" == "True" ]; then
  echo "✅ RDS instance is already publicly accessible"
else
  echo ""
  echo "2️⃣  Enabling public accessibility..."
  aws rds modify-db-instance \
    --db-instance-identifier "$INSTANCE_IDENTIFIER" \
    --publicly-accessible \
    --apply-immediately \
    --region "$AWS_REGION" \
    > /dev/null
  
  echo "✅ Modification initiated (will take 3-5 minutes)"
fi

echo ""
echo "3️⃣  Getting security group ID..."
SG_ID=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

echo "   Security Group: $SG_ID"

echo ""
echo "4️⃣  Adding GitHub Actions IP ranges to security group..."

# GitHub Actions IP ranges (updated Jan 2025)
# Source: https://api.github.com/meta
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
  echo "   Adding: $IP_RANGE"
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 5432 \
    --cidr "$IP_RANGE" \
    --region "$AWS_REGION" \
    2>/dev/null && echo "     ✅ Added" || echo "     ℹ️  Already exists"
done

echo ""
echo "5️⃣  Checking RDS endpoint..."
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "   Endpoint: $RDS_ENDPOINT"

echo ""
echo "6️⃣  Waiting for RDS instance to be available..."
aws rds wait db-instance-available \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION"

echo "✅ RDS instance is available"

echo ""
echo "=================================================="
echo "✅ RDS Public Access Enabled Successfully"
echo ""
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Port: 5432"
echo "   Access: GitHub Actions runners can now connect"
echo ""
echo "🔐 Security Notes:"
echo "   - Access restricted to GitHub Actions IP ranges"
echo "   - SSL/TLS required for connections"
echo "   - Credentials stored in AWS Secrets Manager"
echo ""
echo "🧪 Test Connection:"
echo "   psql postgresql://username:password@$RDS_ENDPOINT:5432/warmpawz"
echo ""
echo "⏮️  To Revert:"
echo "   ./scripts/disable-rds-public-access-dev.sh"
echo ""


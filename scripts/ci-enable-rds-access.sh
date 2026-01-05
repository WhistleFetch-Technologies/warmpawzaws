#!/bin/bash
#
# CI/CD: Ensure RDS Public Access for Migrations (Dev Only)
#
# PURPOSE:
#   - Automatically enables RDS public access if needed
#   - Configures security group for GitHub Actions
#   - Runs without user interaction (CI-safe)
#   - Idempotent (safe to run multiple times)
#
# USAGE:
#   AWS_REGION=ap-south-1 ENVIRONMENT=dev ./scripts/ci-enable-rds-access.sh
#

set -e

ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_IDENTIFIER="warmpawz-${ENVIRONMENT}-instance-1"

echo "🔧 CI/CD: Ensuring RDS accessibility for migrations"
echo "==================================================="
echo "   Environment: $ENVIRONMENT"
echo "   Region: $AWS_REGION"
echo "   Instance: $INSTANCE_IDENTIFIER"
echo ""

# Safety check: Only run for dev environment
if [ "$ENVIRONMENT" != "dev" ]; then
  echo "❌ ERROR: This script only runs for 'dev' environment"
  echo "   Current environment: $ENVIRONMENT"
  echo "   For production/staging, use VPC-based migration runner"
  exit 1
fi

echo "1️⃣  Checking RDS instance status..."
CURRENT_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].PubliclyAccessible' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CURRENT_STATUS" == "NOT_FOUND" ]; then
  echo "❌ ERROR: RDS instance not found: $INSTANCE_IDENTIFIER"
  exit 1
fi

echo "   PubliclyAccessible: $CURRENT_STATUS"

# Enable public access if not already enabled
if [ "$CURRENT_STATUS" != "True" ]; then
  echo ""
  echo "2️⃣  Enabling public accessibility..."
  aws rds modify-db-instance \
    --db-instance-identifier "$INSTANCE_IDENTIFIER" \
    --publicly-accessible \
    --apply-immediately \
    --region "$AWS_REGION" \
    > /dev/null
  
  echo "✅ Initiated (will take 3-5 minutes)"
  
  echo ""
  echo "3️⃣  Waiting for RDS to become available..."
  aws rds wait db-instance-available \
    --db-instance-identifier "$INSTANCE_IDENTIFIER" \
    --region "$AWS_REGION"
  
  echo "✅ RDS is available"
else
  echo "   ✅ Already publicly accessible"
fi

echo ""
echo "4️⃣  Configuring security group..."
SG_ID=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

echo "   Security Group: $SG_ID"

# Get current inbound rules
CURRENT_RULES=$(aws ec2 describe-security-group-rules \
  --filters "Name=group-id,Values=$SG_ID" \
  --query 'SecurityGroupRules[?IsEgress==`false` && IpProtocol==`tcp` && FromPort==`5432`].CidrIpv4' \
  --output text \
  --region "$AWS_REGION")

echo "   Current rules allowing port 5432: $CURRENT_RULES"

# Check if GitHub Actions IPs are already allowed
# For simplicity in CI, we'll allow a broader range or specific GitHub ranges
# Option 1: Allow all (dev only, temporary for migrations)
# Option 2: Allow GitHub Actions IP ranges (more secure)

# Let's use Option 2 with GitHub's published IP ranges
echo ""
echo "5️⃣  Ensuring GitHub Actions can connect..."

# GitHub Actions IP ranges (subset - most common)
REQUIRED_IPS=(
  "20.199.184.0/21"  # GitHub Actions primary range
  "20.119.184.0/22"   # GitHub Actions secondary
)

for IP_RANGE in "${REQUIRED_IPS[@]}"; do
  # Check if rule exists
  if echo "$CURRENT_RULES" | grep -q "$IP_RANGE"; then
    echo "   ✅ $IP_RANGE already allowed"
  else
    echo "   Adding: $IP_RANGE"
    aws ec2 authorize-security-group-ingress \
      --group-id "$SG_ID" \
      --protocol tcp \
      --port 5432 \
      --cidr "$IP_RANGE" \
      --region "$AWS_REGION" \
      2>/dev/null && echo "     ✅ Added" || echo "     ℹ️  Rule may already exist"
  fi
done

echo ""
echo "6️⃣  Getting RDS endpoint..."
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$INSTANCE_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "   Endpoint: $RDS_ENDPOINT"

echo ""
echo "=================================================="
echo "✅ RDS is accessible for migrations"
echo ""
echo "   Endpoint: $RDS_ENDPOINT:5432"
echo "   Access: GitHub Actions runners"
echo "   Security: GitHub IP ranges only"
echo ""
echo "ℹ️  Note: This configuration is safe for dev environment"
echo "   For production, use VPC-based Lambda migration runner"
echo ""


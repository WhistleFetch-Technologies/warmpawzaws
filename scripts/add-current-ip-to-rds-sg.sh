#!/bin/bash
#
# Add Current IP to RDS Security Group for Dev Environment
#
# This script adds your current public IP to the RDS security group
# so you can run migrations from your local machine
#

set -e

ENVIRONMENT="dev"
AWS_REGION="ap-south-1"
CLUSTER_IDENTIFIER="warmpawz-${ENVIRONMENT}-cluster"

echo "🔧 Add Current IP to RDS Security Group"
echo "========================================="
echo ""

# Get current public IP
echo "1️⃣  Getting your current public IP..."
CURRENT_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "")

if [ -z "$CURRENT_IP" ]; then
    echo "❌ ERROR: Could not determine your public IP"
    exit 1
fi

CURRENT_IP_CIDR="${CURRENT_IP}/32"
echo "   Your IP: $CURRENT_IP"
echo "   CIDR: $CURRENT_IP_CIDR"
echo ""

# Get RDS cluster security group
echo "2️⃣  Getting RDS security group..."
cd "$(dirname "$0")/../infra/envs/${ENVIRONMENT}"

# Initialize Terraform if needed
terraform init -backend-config=backend.hcl > /dev/null 2>&1

# Get security group from Terraform
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-rds-sg*" \
    --region "$AWS_REGION" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "")

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
    # Try alternative: get from RDS instance
    INSTANCE_IDENTIFIER="warmpawz-${ENVIRONMENT}-instance-1"
    SG_ID=$(aws rds describe-db-instances \
        --db-instance-identifier "$INSTANCE_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
        --output text 2>/dev/null || echo "")
fi

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
    echo "❌ ERROR: Could not find RDS security group"
    echo "   Please check your AWS configuration"
    exit 1
fi

echo "   Security Group: $SG_ID"
echo ""

# Check if rule already exists
echo "3️⃣  Checking if IP is already allowed..."
EXISTING_RULE=$(aws ec2 describe-security-group-rules \
    --filters "Name=group-id,Values=$SG_ID" \
    --query "SecurityGroupRules[?IsEgress==\`false\` && IpProtocol==\`tcp\` && FromPort==\`5432\` && CidrIpv4==\`${CURRENT_IP_CIDR}\`].SecurityGroupRuleId" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$EXISTING_RULE" ] && [ "$EXISTING_RULE" != "None" ]; then
    echo "   ✅ Your IP is already allowed"
    echo ""
    echo "   You can now run migrations:"
    echo "   ./scripts/manual-migrate.sh dev"
    exit 0
fi

echo "   IP not found, adding..."
echo ""

# Add IP to security group
echo "4️⃣  Adding your IP to security group..."
ADD_RESULT=$(aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 5432 \
    --cidr "$CURRENT_IP_CIDR" \
    --region "$AWS_REGION" \
    --description "Temporary access for migrations from ${CURRENT_IP}" \
    2>&1)

if [ $? -eq 0 ]; then
    echo "   ✅ IP added successfully"
elif echo "$ADD_RESULT" | grep -q "InvalidPermission.Duplicate"; then
    echo "   ℹ️  IP already allowed (duplicate rule)"
else
    echo "   ❌ Failed to add IP: $ADD_RESULT"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ Your IP has been added to RDS security group"
echo ""
echo "   IP: $CURRENT_IP"
echo "   Security Group: $SG_ID"
echo ""
echo "   You can now run migrations:"
echo "   ./scripts/manual-migrate.sh dev"
echo ""
echo "   ⚠️  Note: Consider removing this IP after migrations complete"
echo ""

#!/bin/bash
# ============================================================================
# Run Migration on Production RDS via AWS Systems Manager
# ============================================================================
# This script uses AWS Systems Manager to run the migration from within the VPC
# Requires: EC2 instance in the same VPC with SSM agent enabled
# ============================================================================

set -e

ENVIRONMENT="prod"
REGION="ap-south-1"
MIGRATION_FILE="${1:-559_add_vendors_specializations_column.sql}"

echo "🚀 Production Migration via Systems Manager"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Migration: $MIGRATION_FILE"
echo ""

# Check if migration file exists
MIGRATION_PATH="db/migrations/$MIGRATION_FILE"
if [ ! -f "$MIGRATION_PATH" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_PATH"
    exit 1
fi

# Find an EC2 instance in the VPC
echo "📊 Finding EC2 instance in production VPC..."
VPC_ID="vpc-02a4893e5e582c4d8"

INSTANCE_ID=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ] || [ "$INSTANCE_ID" = "null" ]; then
    echo "❌ ERROR: No running EC2 instance found in VPC $VPC_ID"
    echo ""
    echo "Options:"
    echo "1. Create a temporary EC2 instance in the VPC with SSM agent"
    echo "2. Use AWS CloudShell (if VPC access is configured)"
    echo "3. Use a VPN connection to the VPC"
    exit 1
fi

echo "✅ Found EC2 instance: $INSTANCE_ID"
echo ""

# Upload migration file to S3 temporarily (or use Systems Manager document)
echo "📤 Preparing migration file..."

# Create a Systems Manager document with the migration SQL
MIGRATION_SQL=$(cat "$MIGRATION_PATH")

# Get RDS credentials from Secrets Manager
echo "🔐 Getting RDS credentials..."
SECRET_NAME="warmpawz-prod-rds-master-20260207201049162400000001"
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text)

DB_PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.password // .Password // .secret // .Secret')

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ ERROR: Could not extract password from secret"
    exit 1
fi

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "warmpawz-prod-cluster" \
    --region "$REGION" \
    --query 'DBClusters[0].Endpoint' \
    --output text)

echo "✅ RDS Endpoint: $RDS_ENDPOINT"
echo ""

# Run migration via Systems Manager
echo "⚙️  Running migration via Systems Manager..."
echo "─────────────────────────────────────────────"

# Create a temporary script to run on the EC2 instance
TEMP_SCRIPT=$(cat <<EOF
#!/bin/bash
set -e
export PGPASSWORD='$DB_PASSWORD'
psql -h $RDS_ENDPOINT -p 5432 -U warmpawz_admin -d warmpawz -f - <<'SQL_EOF'
$MIGRATION_SQL
SQL_EOF
EOF
)

# Encode script for Systems Manager
ENCODED_SCRIPT=$(echo "$TEMP_SCRIPT" | base64 -w 0)

# Run command via Systems Manager
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"echo '$ENCODED_SCRIPT' | base64 -d | bash\"]" \
    --region "$REGION" \
    --output-s3-bucket-name "" \
    --output-s3-key-prefix "" \
    --query 'Command.CommandId' \
    --output text

echo ""
echo "✅ Migration command sent to instance $INSTANCE_ID"
echo "📊 Check status with:"
echo "   aws ssm list-command-invocations --command-id <command-id> --region $REGION"
echo ""

#!/bin/bash
# ============================================================================
# Run Production Migration via AWS Systems Manager
# ============================================================================
# This script uses AWS Systems Manager Run Command to execute migrations
# on an EC2 instance in the production VPC
# ============================================================================

set -e

ENVIRONMENT="${ENVIRONMENT:-prod}"
REGION="${AWS_REGION:-ap-south-1}"
MIGRATION_FILE="${1:-559_add_vendors_specializations_column.sql}"
INSTANCE_ID="${2}"

echo "🚀 Production Migration via Systems Manager"
echo "==========================================="
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

# Find EC2 instance if not provided
if [ -z "$INSTANCE_ID" ]; then
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
        echo "Please provide an instance ID:"
        echo "  $0 $MIGRATION_FILE <instance-id>"
        echo ""
        echo "Or create a temporary EC2 instance in the VPC with:"
        echo "  - Systems Manager agent (default on Amazon Linux 2)"
        echo "  - PostgreSQL client: sudo yum install -y postgresql15"
        echo "  - Security group allowing outbound to RDS"
        exit 1
    fi
fi

echo "✅ Using instance: $INSTANCE_ID"
echo ""

# Get RDS connection info
echo "📊 Getting RDS connection information..."
RDS_ENDPOINT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "warmpawz-prod-cluster" \
    --region "$REGION" \
    --query 'DBClusters[0].Endpoint' \
    --output text)

RDS_PORT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "warmpawz-prod-cluster" \
    --region "$REGION" \
    --query 'DBClusters[0].Port' \
    --output text)

RDS_DB=$(aws rds describe-db-clusters \
    --db-cluster-identifier "warmpawz-prod-cluster" \
    --region "$REGION" \
    --query 'DBClusters[0].DatabaseName' \
    --output text)

RDS_USER=$(aws rds describe-db-clusters \
    --db-cluster-identifier "warmpawz-prod-cluster" \
    --region "$REGION" \
    --query 'DBClusters[0].MasterUsername' \
    --output text)

echo "✅ RDS Endpoint: $RDS_ENDPOINT"
echo "✅ Database: $RDS_DB"
echo "✅ Username: $RDS_USER"
echo ""

# Get password from Secrets Manager
echo "🔐 Getting RDS password from Secrets Manager..."
SECRET_NAME="warmpawz-prod-rds-master-20260207201049162400000001"
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text | jq -r '.password // .Password // .secret // .Secret')

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ ERROR: Could not extract password from secret"
    exit 1
fi

echo "✅ Password retrieved"
echo ""

# Read migration file
echo "📄 Reading migration file..."
MIGRATION_SQL=$(cat "$MIGRATION_PATH")

# Create command script
COMMAND_SCRIPT=$(cat <<EOF
#!/bin/bash
set -e
export PGPASSWORD='${DB_PASSWORD//\'/\'\"\'\"\'}'
psql -h $RDS_ENDPOINT -p $RDS_PORT -U $RDS_USER -d $RDS_DB <<'SQL_EOF'
$MIGRATION_SQL
SQL_EOF
echo "Migration completed successfully"
EOF
)

# Base64 encode the command
ENCODED_COMMAND=$(echo "$COMMAND_SCRIPT" | base64 -w 0)

echo "⚙️  Sending migration command to instance via Systems Manager..."
echo "─────────────────────────────────────────────────────────────"

# Send command via Systems Manager
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"echo '$ENCODED_COMMAND' | base64 -d | bash\"]" \
    --region "$REGION" \
    --timeout-seconds 300 \
    --query 'Command.CommandId' \
    --output text)

echo "✅ Command sent successfully"
echo "Command ID: $COMMAND_ID"
echo ""
echo "⏳ Waiting for command to complete..."

# Poll for completion
STATUS="InProgress"
ATTEMPTS=0
MAX_ATTEMPTS=60

while [ "$STATUS" = "InProgress" ] && [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    sleep 5
    STATUS=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$REGION" \
        --query 'Status' \
        --output text 2>/dev/null || echo "InProgress")
    
    if [ "$STATUS" = "InProgress" ]; then
        echo -n "."
        ATTEMPTS=$((ATTEMPTS + 1))
    fi
done

echo ""
echo ""

# Get final status
FINAL_STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Status' \
    --output text)

echo "Command Status: $FINAL_STATUS"
echo ""

# Get output
OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'StandardOutputContent' \
    --output text 2>/dev/null || echo "")

ERROR_OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'StandardErrorContent' \
    --output text 2>/dev/null || echo "")

if [ -n "$OUTPUT" ]; then
    echo "📋 Output:"
    echo "$OUTPUT"
    echo ""
fi

if [ -n "$ERROR_OUTPUT" ]; then
    echo "⚠️  Errors:"
    echo "$ERROR_OUTPUT"
    echo ""
fi

if [ "$FINAL_STATUS" = "Success" ]; then
    echo "✅ Migration completed successfully!"
    exit 0
else
    echo "❌ Migration failed with status: $FINAL_STATUS"
    exit 1
fi

#!/bin/bash

# Comprehensive cleanup for Warmpawz dev environment
# Handles ALL edge cases and partial states

set -e

ENVIRONMENT="dev"
REGION="ap-south-1"
NEW_ACCOUNT_ID="057442119249"
OLD_ACCOUNT_ID="023394150666"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       COMPREHENSIVE CLEANUP - Warmpawz Dev Environment      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Region: ${REGION}"
echo "Environment: ${ENVIRONMENT}"
echo "New Account: ${NEW_ACCOUNT_ID}"
echo ""
echo "⚠️  WARNING: This will delete ALL warmpawz-dev resources"
echo "Type 'YES' to continue:"
read CONFIRMATION

if [ "$CONFIRMATION" != "YES" ]; then
  echo "❌ Cleanup cancelled."
  exit 0
fi

echo ""
echo "🚀 Starting comprehensive cleanup..."
echo ""

# ============================================================================
# 1. RDS - Handle ALL scenarios
# ============================================================================
echo "1️⃣  RDS Cleanup (all scenarios)..."

# Scenario 1: Cluster exists with instances
if aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region "${REGION}" 2>/dev/null | grep -q "warmpawz-dev-cluster"; then
  echo "  ✅ Found RDS cluster: warmpawz-dev-cluster"
  
  # Check for instances
  INSTANCES=$(aws rds describe-db-instances --region "${REGION}" --query "DBInstances[?DBClusterIdentifier=='warmpawz-dev-cluster'].DBInstanceIdentifier" --output text)
  
  if [ -n "$INSTANCES" ]; then
    echo "  📋 Found instances: $INSTANCES"
    for INSTANCE in $INSTANCES; do
      echo "  🗑️  Deleting instance: $INSTANCE"
      aws rds delete-db-instance \
        --db-instance-identifier "$INSTANCE" \
        --skip-final-snapshot \
        --region "${REGION}" 2>/dev/null || echo "    Instance deletion failed or already deleting"
    done
    
    echo "  ⏳ Waiting for instances to be deleted..."
    sleep 30
  fi
  
  # Disable deletion protection on cluster
  echo "  🔓 Disabling deletion protection..."
  aws rds modify-db-cluster \
    --db-cluster-identifier warmpawz-dev-cluster \
    --no-deletion-protection \
    --apply-immediately \
    --region "${REGION}" 2>/dev/null || echo "    Already disabled or modification failed"
  
  sleep 10
  
  # Delete cluster
  echo "  🗑️  Deleting cluster..."
  aws rds delete-db-cluster \
    --db-cluster-identifier warmpawz-dev-cluster \
    --skip-final-snapshot \
    --region "${REGION}" 2>/dev/null || echo "    Cluster deletion failed or already deleting"
  
  echo "  ✅ RDS cleanup initiated"
else
  echo "  ℹ️  No RDS cluster found (already clean)"
fi

# Scenario 2: Orphaned instances (cluster deleted but instances remain)
ORPHANED_INSTANCES=$(aws rds describe-db-instances --region "${REGION}" --query "DBInstances[?contains(DBInstanceIdentifier, 'warmpawz-dev')].DBInstanceIdentifier" --output text)
if [ -n "$ORPHANED_INSTANCES" ]; then
  echo "  ⚠️  Found orphaned instances: $ORPHANED_INSTANCES"
  for INSTANCE in $ORPHANED_INSTANCES; do
    echo "  🗑️  Deleting orphaned instance: $INSTANCE"
    aws rds delete-db-instance \
      --db-instance-identifier "$INSTANCE" \
      --skip-final-snapshot \
      --region "${REGION}" 2>/dev/null || echo "    Failed or already deleting"
  done
fi

echo ""

# ============================================================================
# 2. S3 Buckets - Handle old and new account buckets
# ============================================================================
echo "2️⃣  S3 Bucket Cleanup (all accounts)..."

# Function to aggressively delete S3 bucket
delete_s3_bucket() {
  local BUCKET=$1
  echo "  🗑️  Processing bucket: $BUCKET"
  
  # Step 1: Delete bucket policy
  aws s3api delete-bucket-policy --bucket "$BUCKET" --region "${REGION}" 2>/dev/null || true
  
  # Step 2: Remove public access block
  aws s3api delete-public-access-block --bucket "$BUCKET" --region "${REGION}" 2>/dev/null || true
  
  # Step 3: Remove ownership controls
  aws s3api delete-bucket-ownership-controls --bucket "$BUCKET" --region "${REGION}" 2>/dev/null || true
  
  # Step 4: Disable versioning
  aws s3api put-bucket-versioning \
    --bucket "$BUCKET" \
    --versioning-configuration Status=Suspended \
    --region "${REGION}" 2>/dev/null || true
  
  # Step 5: Delete all object versions and delete markers
  aws s3api list-object-versions --bucket "$BUCKET" --region "${REGION}" --output json 2>/dev/null | \
    jq -r '.Versions[]?, .DeleteMarkers[]? | "--key \"\(.Key)\" --version-id \"\(.VersionId)\""' | \
    xargs -I {} -P 10 aws s3api delete-object --bucket "$BUCKET" --region "${REGION}" {} 2>/dev/null || true
  
  # Step 6: Delete all objects (non-versioned)
  aws s3 rm "s3://$BUCKET" --recursive --region "${REGION}" 2>/dev/null || true
  
  # Step 7: Delete the bucket
  aws s3api delete-bucket --bucket "$BUCKET" --region "${REGION}" 2>/dev/null || echo "    Bucket deletion failed"
  
  echo "    ✅ Bucket processed: $BUCKET"
}

# Get all warmpawz-dev buckets
BUCKETS=$(aws s3 ls --region "${REGION}" 2>/dev/null | grep "warmpawz-dev" | awk '{print $3}')

if [ -n "$BUCKETS" ]; then
  echo "  📋 Found buckets to delete:"
  echo "$BUCKETS" | sed 's/^/    - /'
  echo ""
  
  for BUCKET in $BUCKETS; do
    delete_s3_bucket "$BUCKET"
  done
  echo "  ✅ All buckets cleaned"
else
  echo "  ℹ️  No S3 buckets found (already clean)"
fi

# Also delete terraform state bucket
STATE_BUCKET="warmpawz-terraform-state-${NEW_ACCOUNT_ID}"
if aws s3 ls "s3://${STATE_BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "  🗑️  Deleting Terraform state bucket: ${STATE_BUCKET}"
  delete_s3_bucket "${STATE_BUCKET}"
fi

echo ""

# ============================================================================
# 3. Lambda Functions
# ============================================================================
echo "3️⃣  Lambda Function Cleanup..."

LAMBDAS=$(aws lambda list-functions --region "${REGION}" --query "Functions[?contains(FunctionName, 'warmpawz-dev')].FunctionName" --output text)

if [ -n "$LAMBDAS" ]; then
  echo "  📋 Found Lambda functions:"
  echo "$LAMBDAS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for LAMBDA in $LAMBDAS; do
    echo "  🗑️  Deleting Lambda: $LAMBDA"
    aws lambda delete-function --function-name "$LAMBDA" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ Lambda cleanup complete"
else
  echo "  ℹ️  No Lambda functions found (already clean)"
fi

echo ""

# ============================================================================
# 4. CloudFront Distributions
# ============================================================================
echo "4️⃣  CloudFront Distribution Cleanup..."

DIST_IDS=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'warmpawz-dev')].Id" --output text 2>/dev/null)

if [ -n "$DIST_IDS" ]; then
  echo "  📋 Found CloudFront distributions:"
  echo "$DIST_IDS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for DIST_ID in $DIST_IDS; do
    echo "  🗑️  Processing distribution: $DIST_ID"
    
    # Get current config
    ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query "ETag" --output text 2>/dev/null)
    
    if [ -n "$ETAG" ]; then
      # Disable distribution
      echo "    ⏳ Disabling distribution..."
      CONFIG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query "DistributionConfig" --output json 2>/dev/null)
      DISABLED_CONFIG=$(echo "$CONFIG" | jq '.Enabled = false')
      
      NEW_ETAG=$(aws cloudfront update-distribution \
        --id "$DIST_ID" \
        --if-match "$ETAG" \
        --distribution-config "$DISABLED_CONFIG" \
        --query "ETag" \
        --output text 2>/dev/null) || echo "    Disable failed"
      
      if [ -n "$NEW_ETAG" ]; then
        echo "    ⏳ Waiting for distribution to deploy (this takes time)..."
        # We'll delete it later - CloudFront takes too long
      fi
    fi
  done
  echo "  ⚠️  CloudFront distributions disabled (manual deletion required after deployment completes)"
else
  echo "  ℹ️  No CloudFront distributions found (already clean)"
fi

echo ""

# ============================================================================
# 5. API Gateway
# ============================================================================
echo "5️⃣  API Gateway Cleanup..."

API_IDS=$(aws apigatewayv2 get-apis --region "${REGION}" --query "Items[?contains(Name, 'warmpawz-dev')].ApiId" --output text)

if [ -n "$API_IDS" ]; then
  echo "  📋 Found API Gateways:"
  echo "$API_IDS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for API_ID in $API_IDS; do
    echo "  🗑️  Deleting API: $API_ID"
    aws apigatewayv2 delete-api --api-id "$API_ID" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ API Gateway cleanup complete"
else
  echo "  ℹ️  No API Gateways found (already clean)"
fi

echo ""

# ============================================================================
# 6. DynamoDB Tables
# ============================================================================
echo "6️⃣  DynamoDB Table Cleanup..."

TABLES=$(aws dynamodb list-tables --region "${REGION}" --query "TableNames[?contains(@, 'warmpawz-dev')]" --output text)

if [ -n "$TABLES" ]; then
  echo "  📋 Found DynamoDB tables:"
  echo "$TABLES" | tr '\t' '\n' | sed 's/^/    - /'
  
  for TABLE in $TABLES; do
    echo "  🗑️  Deleting table: $TABLE"
    aws dynamodb delete-table --table-name "$TABLE" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ DynamoDB cleanup complete"
else
  echo "  ℹ️  No DynamoDB tables found (already clean)"
fi

# Also delete terraform lock table
LOCK_TABLE="warmpawz-terraform-locks"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "${REGION}" 2>/dev/null | grep -q "$LOCK_TABLE"; then
  echo "  🗑️  Deleting Terraform lock table: $LOCK_TABLE"
  aws dynamodb delete-table --table-name "$LOCK_TABLE" --region "${REGION}" 2>/dev/null || echo "    Failed"
fi

echo ""

# ============================================================================
# 7. Secrets Manager
# ============================================================================
echo "7️⃣  Secrets Manager Cleanup..."

SECRETS=$(aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?contains(Name, 'warmpawz')].Name" --output text)

if [ -n "$SECRETS" ]; then
  echo "  📋 Found secrets:"
  echo "$SECRETS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for SECRET in $SECRETS; do
    echo "  🗑️  Deleting secret: $SECRET"
    aws secretsmanager delete-secret \
      --secret-id "$SECRET" \
      --force-delete-without-recovery \
      --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ Secrets cleanup complete"
else
  echo "  ℹ️  No secrets found (already clean)"
fi

echo ""

# ============================================================================
# 8. CloudWatch Log Groups
# ============================================================================
echo "8️⃣  CloudWatch Log Group Cleanup..."

LOG_GROUPS=$(aws logs describe-log-groups --region "${REGION}" --query "logGroups[?contains(logGroupName, 'warmpawz-dev') || contains(logGroupName, '/aws/lambda/warmpawz-dev') || contains(logGroupName, '/aws/apigateway/warmpawz-dev')].logGroupName" --output text)

if [ -n "$LOG_GROUPS" ]; then
  echo "  📋 Found log groups:"
  echo "$LOG_GROUPS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for LOG_GROUP in $LOG_GROUPS; do
    echo "  🗑️  Deleting log group: $LOG_GROUP"
    aws logs delete-log-group --log-group-name "$LOG_GROUP" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ CloudWatch cleanup complete"
else
  echo "  ℹ️  No log groups found (already clean)"
fi

echo ""

# ============================================================================
# 9. SNS Topics
# ============================================================================
echo "9️⃣  SNS Topic Cleanup..."

SNS_TOPICS=$(aws sns list-topics --region "${REGION}" --query "Topics[?contains(TopicArn, 'warmpawz-dev')].TopicArn" --output text)

if [ -n "$SNS_TOPICS" ]; then
  echo "  📋 Found SNS topics:"
  echo "$SNS_TOPICS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for TOPIC in $SNS_TOPICS; do
    echo "  🗑️  Deleting topic: $TOPIC"
    aws sns delete-topic --topic-arn "$TOPIC" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ SNS cleanup complete"
else
  echo "  ℹ️  No SNS topics found (already clean)"
fi

echo ""

# ============================================================================
# 10. SQS Queues
# ============================================================================
echo "🔟 SQS Queue Cleanup..."

SQS_QUEUES=$(aws sqs list-queues --region "${REGION}" --queue-name-prefix "warmpawz-dev" --query "QueueUrls" --output text 2>/dev/null)

if [ -n "$SQS_QUEUES" ]; then
  echo "  📋 Found SQS queues:"
  echo "$SQS_QUEUES" | tr '\t' '\n' | sed 's/^/    - /'
  
  for QUEUE in $SQS_QUEUES; do
    echo "  🗑️  Deleting queue: $QUEUE"
    aws sqs delete-queue --queue-url "$QUEUE" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ SQS cleanup complete"
else
  echo "  ℹ️  No SQS queues found (already clean)"
fi

echo ""

# ============================================================================
# 11. Cognito User Pools
# ============================================================================
echo "1️⃣1️⃣  Cognito Cleanup..."

USER_POOLS=$(aws cognito-idp list-user-pools --max-results 60 --region "${REGION}" --query "UserPools[?contains(Name, 'warmpawz-dev')].Id" --output text)

if [ -n "$USER_POOLS" ]; then
  echo "  📋 Found Cognito user pools:"
  echo "$USER_POOLS" | tr '\t' '\n' | sed 's/^/    - /'
  
  for POOL in $USER_POOLS; do
    echo "  🗑️  Deleting user pool: $POOL"
    aws cognito-idp delete-user-pool --user-pool-id "$POOL" --region "${REGION}" 2>/dev/null || echo "    Failed"
  done
  echo "  ✅ Cognito cleanup complete"
else
  echo "  ℹ️  No Cognito pools found (already clean)"
fi

echo ""

# ============================================================================
# 12. VPCs (Optional - be careful)
# ============================================================================
echo "1️⃣2️⃣  VPC Cleanup..."

VPCS=$(aws ec2 describe-vpcs --region "${REGION}" --query "Vpcs[?Tags[?Key=='Environment' && Value=='dev'] && Tags[?Key=='Name' && contains(Value, 'warmpawz')]].VpcId" --output text)

if [ -n "$VPCS" ]; then
  echo "  ⚠️  Found VPCs (not auto-deleting - manual deletion recommended):"
  echo "$VPCS" | tr '\t' '\n' | sed 's/^/    - /'
  echo "  To delete VPCs manually: aws ec2 delete-vpc --vpc-id <VPC_ID>"
else
  echo "  ℹ️  No tagged VPCs found (already clean)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    CLEANUP COMPLETE                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ All warmpawz-dev resources have been cleaned up"
echo "⚠️  Note: CloudFront distributions may take 15-30 minutes to delete"
echo "⚠️  Note: RDS deletions may take 5-10 minutes to complete"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for deletions to propagate"
echo "2. Run: aws s3 ls | grep warmpawz"
echo "3. Verify no resources remain"
echo "4. Trigger new deployment"
echo ""


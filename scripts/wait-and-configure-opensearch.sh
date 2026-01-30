#!/bin/bash

# ============================================================================
# Wait for OpenSearch Domain and Configure
# ============================================================================

set -e

REGION="ap-south-1"
DOMAIN_NAME="warmpawz-search"
LAMBDA_FUNCTION="warmpawz-dev-api-handler"
MAX_WAIT=1800  # 30 minutes
CHECK_INTERVAL=30  # Check every 30 seconds
ELAPSED=0

echo "⏳ Waiting for OpenSearch domain to be available..."
echo "This may take 15-30 minutes..."
echo ""

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION --query 'DomainStatus.Processing' --output text 2>/dev/null || echo "true")
    
    if [ "$STATUS" = "false" ]; then
        echo "✅ Domain is now available!"
        break
    fi
    
    echo "⏳ Still creating... (${ELAPSED}s elapsed)"
    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
done

if [ "$STATUS" != "false" ]; then
    echo "⚠️  Domain creation is taking longer than expected"
    echo "Please check status manually:"
    echo "aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION"
    exit 1
fi

# Get endpoint
echo ""
echo "🔗 Getting OpenSearch endpoint..."
DOMAIN_INFO=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION)
ENDPOINT=$(echo "$DOMAIN_INFO" | grep -oP '"Endpoint":\s*"\K[^"]+' | head -1)

if [ -z "$ENDPOINT" ]; then
    # Try VPC endpoint
    ENDPOINT=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION --query 'DomainStatus.Endpoints.vpc' --output text 2>/dev/null || echo "")
fi

if [ -z "$ENDPOINT" ] || [ "$ENDPOINT" = "None" ]; then
    # Use public endpoint
    ENDPOINT=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION --query 'DomainStatus.Endpoint' --output text 2>/dev/null || echo "")
fi

if [ -z "$ENDPOINT" ] || [ "$ENDPOINT" = "None" ]; then
    echo "❌ Could not retrieve endpoint"
    exit 1
fi

OPENSEARCH_ENDPOINT="https://$ENDPOINT"
echo "✅ OpenSearch endpoint: $OPENSEARCH_ENDPOINT"

# Get Lambda role and account ID
LAMBDA_ROLE_ARN=$(aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $REGION --query 'Role' --output text)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Update Lambda environment variables
echo ""
echo "⚙️  Updating Lambda environment variables..."

CURRENT_ENV=$(aws lambda get-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --region $REGION \
    --query 'Environment.Variables' \
    --output json)

# Merge with new OpenSearch variables using jq
NEW_ENV=$(echo "$CURRENT_ENV" | jq ". + {
    \"OPENSEARCH_ENDPOINT\": \"$OPENSEARCH_ENDPOINT\",
    \"ENABLE_OPENSEARCH\": \"true\"
}")

aws lambda update-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --environment "Variables=$NEW_ENV" \
    --region $REGION > /dev/null

echo "✅ Lambda environment variables updated"

# Update OpenSearch access policy
echo ""
echo "🔐 Updating OpenSearch access policy..."

ACCESS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "$LAMBDA_ROLE_ARN"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:$REGION:$ACCOUNT_ID:domain/$DOMAIN_NAME/*"
    }
  ]
}
EOF
)

aws opensearch update-domain-config \
    --domain-name $DOMAIN_NAME \
    --access-policies "$ACCESS_POLICY" \
    --region $REGION > /dev/null

echo "✅ OpenSearch access policy updated"

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Next: Deploy the sync job with: ./scripts/deploy-opensearch-sync.sh"

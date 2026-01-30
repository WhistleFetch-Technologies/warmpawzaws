#!/bin/bash

# ============================================================================
# OpenSearch Setup Script
# ============================================================================
# This script helps set up AWS OpenSearch for the Warmpawz search functionality
# ============================================================================

set -e

REGION="ap-south-1"
DOMAIN_NAME="warmpawz-search"
LAMBDA_FUNCTION="warmpawz-dev-api-handler"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🔍 OpenSearch Setup for Warmpawz"
echo "=================================="
echo ""

# Check if OpenSearch domain exists
echo "📋 Checking for existing OpenSearch domains..."
EXISTING_DOMAINS=$(aws opensearch list-domain-names --region $REGION --query 'DomainNames[*].DomainName' --output text)

if [ -z "$EXISTING_DOMAINS" ]; then
    echo "❌ No OpenSearch domains found"
    echo ""
    echo "To create a new OpenSearch domain, run:"
    echo ""
    echo "aws opensearch create-domain \\"
    echo "  --domain-name $DOMAIN_NAME \\"
    echo "  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \\"
    echo "  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \\"
    echo "  --engine-version OpenSearch_2.11 \\"
    echo "  --node-to-node-encryption-options Enabled=true \\"
    echo "  --encryption-at-rest-options Enabled=true \\"
    echo "  --region $REGION"
    echo ""
    echo "⚠️  Note: Domain creation takes 15-30 minutes"
    echo ""
    read -p "Do you want to create the domain now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Creating OpenSearch domain..."
        aws opensearch create-domain \
            --domain-name $DOMAIN_NAME \
            --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
            --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \
            --engine-version OpenSearch_2.11 \
            --node-to-node-encryption-options Enabled=true \
            --encryption-at-rest-options Enabled=true \
            --region $REGION
        
        echo "⏳ Waiting for domain to be created (this may take 15-30 minutes)..."
        aws opensearch wait domain-available --domain-name $DOMAIN_NAME --region $REGION
        echo "✅ Domain created successfully!"
    else
        echo "Skipping domain creation. Please create it manually or use an existing domain."
        exit 1
    fi
else
    echo "✅ Found existing domains: $EXISTING_DOMAINS"
    if echo "$EXISTING_DOMAINS" | grep -q "$DOMAIN_NAME"; then
        echo "✅ Using existing domain: $DOMAIN_NAME"
    else
        echo "⚠️  Domain '$DOMAIN_NAME' not found. Using first available: $(echo $EXISTING_DOMAINS | cut -d' ' -f1)"
        DOMAIN_NAME=$(echo $EXISTING_DOMAINS | cut -d' ' -f1)
    fi
fi

# Get OpenSearch endpoint
echo ""
echo "🔗 Getting OpenSearch endpoint..."
DOMAIN_INFO=$(aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION)
ENDPOINT=$(echo "$DOMAIN_INFO" | grep -oP '"Endpoint":\s*"\K[^"]+' | head -1)

if [ -z "$ENDPOINT" ]; then
    echo "❌ Could not retrieve endpoint. Domain may still be creating..."
    echo "Please wait and run this script again once the domain is available."
    exit 1
fi

OPENSEARCH_ENDPOINT="https://$ENDPOINT"
echo "✅ OpenSearch endpoint: $OPENSEARCH_ENDPOINT"

# Update Lambda environment variables
echo ""
echo "⚙️  Updating Lambda environment variables..."

# Get current environment variables
CURRENT_ENV=$(aws lambda get-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --region $REGION \
    --query 'Environment.Variables' \
    --output json)

# Merge with new OpenSearch variables
echo "$CURRENT_ENV" | jq ". + {
    \"OPENSEARCH_ENDPOINT\": \"$OPENSEARCH_ENDPOINT\",
    \"ENABLE_OPENSEARCH\": \"true\"
}" > /tmp/lambda-env.json

aws lambda update-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --environment "Variables=$(cat /tmp/lambda-env.json)" \
    --region $REGION > /dev/null

echo "✅ Lambda environment variables updated"

# Update access policy for OpenSearch
echo ""
echo "🔐 Updating OpenSearch access policy..."

LAMBDA_ROLE_ARN=$(aws lambda get-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --region $REGION \
    --query 'Role' \
    --output text)

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
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the sync job Lambda (see scripts/deploy-opensearch-sync.sh)"
echo "2. Run initial data sync"
echo "3. Test the search endpoint"
echo ""
echo "Test search:"
echo "curl 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/search?q=vet&limit=5'"

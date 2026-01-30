#!/bin/bash

# ============================================================================
# Deploy OpenSearch Sync Job
# ============================================================================

set -e

REGION="ap-south-1"
FUNCTION_NAME="warmpawz-dev-opensearch-sync"
# Get role from main Lambda function
MAIN_LAMBDA_ROLE=$(aws lambda get-function-configuration --function-name warmpawz-dev-api-handler --region ap-south-1 --query 'Role' --output text 2>/dev/null || echo "")
ROLE_ARN=${MAIN_LAMBDA_ROLE:-""}

echo "🚀 Deploying OpenSearch Sync Job"
echo "================================="
echo ""

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
    echo "📝 Updating existing function..."
    UPDATE_MODE=true
else
    echo "🆕 Creating new function..."
    UPDATE_MODE=false
fi

# Build the sync job
echo "📦 Building sync job..."
cd backend/lambda
npm install

# Build sync job specifically
echo "📦 Building OpenSearch sync job..."
node esbuild-sync.config.js

# Package the sync job handler
echo "📦 Packaging sync job..."
mkdir -p dist/jobs
cd dist/jobs
zip -r ../../../opensearch-sync.zip opensearch-sync.js opensearch-sync.js.map
cd ../../..
SYNC_ZIP_PATH="$(pwd)/opensearch-sync.zip"

# Get IAM role from main Lambda function
echo "🔐 Getting IAM role from main Lambda function..."
if [ -z "$ROLE_ARN" ]; then
    echo "❌ Could not get IAM role from main Lambda function"
    exit 1
fi
echo "✅ Using IAM role: $ROLE_ARN"

if [ "$UPDATE_MODE" = true ]; then
    # Update existing function
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$SYNC_ZIP_PATH \
        --region $REGION > /dev/null
    
    echo "✅ Function code updated"
    
    # Update configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 900 \
        --memory-size 512 \
        --region $REGION > /dev/null
    
    echo "✅ Function configuration updated"
else
    # Create new function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler opensearch-sync.handler \
        --zip-file fileb://$SYNC_ZIP_PATH \
        --timeout 900 \
        --memory-size 512 \
        --environment file:///tmp/sync-env.json \
        --region $REGION > /dev/null
    
    echo "✅ Function created"
fi

# Set up CloudWatch Event Rule for daily sync
echo ""
echo "⏰ Setting up scheduled sync..."

RULE_NAME="warmpawz-opensearch-daily-sync"
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

# Check if rule exists
if aws events describe-rule --name $RULE_NAME --region $REGION &>/dev/null; then
    echo "📝 Updating existing rule..."
    aws events put-rule \
        --name $RULE_NAME \
        --schedule-expression "rate(1 day)" \
        --state ENABLED \
        --region $REGION > /dev/null
else
    echo "🆕 Creating new rule..."
    aws events put-rule \
        --name $RULE_NAME \
        --schedule-expression "rate(1 day)" \
        --state ENABLED \
        --description "Daily OpenSearch sync from RDS" \
        --region $REGION > /dev/null
fi

# Add Lambda permission
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id "opensearch-sync-schedule" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# Add Lambda as target
aws events put-targets \
    --rule $RULE_NAME \
    --targets "Id"="1","Arn"="$FUNCTION_ARN" \
    --region $REGION > /dev/null

echo "✅ Scheduled sync configured (runs daily)"

# Run initial sync
echo ""
read -p "Do you want to run initial sync now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Running initial sync..."
    aws lambda invoke \
        --function-name $FUNCTION_NAME \
        --payload '{}' \
        --region $REGION \
        /tmp/sync-response.json
    
    echo "✅ Initial sync completed"
    echo "Check /tmp/sync-response.json for results"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "The sync job will:"
echo "- Run daily at midnight (CloudWatch Events)"
echo "- Sync services, vendors, staff, products, and problems from RDS to OpenSearch"

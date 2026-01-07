#!/bin/bash
# Lambda Warm-up Script
# Invokes all Lambda functions to eliminate cold starts

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "🔥 Warming up Lambda functions for $ENVIRONMENT environment..."

# Get list of all Lambda functions for this environment
FUNCTIONS=$(aws lambda list-functions \
  --region $AWS_REGION \
  --query "Functions[?contains(FunctionName, 'warmpawz-$ENVIRONMENT')].FunctionName" \
  --output text)

if [ -z "$FUNCTIONS" ]; then
  echo "❌ No Lambda functions found for environment: $ENVIRONMENT"
  exit 1
fi

echo "Found $(echo $FUNCTIONS | wc -w) functions to warm up"

# Warm up each function
for FUNCTION in $FUNCTIONS; do
  echo "  🔥 Warming up: $FUNCTION"
  
  aws lambda invoke \
    --region $AWS_REGION \
    --function-name $FUNCTION \
    --payload '{"warmup": true}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-warmup-response.json > /dev/null 2>&1
  
  echo "  ✅ $FUNCTION warmed up"
  sleep 1
done

echo ""
echo "✅ All Lambda functions warmed up successfully!"


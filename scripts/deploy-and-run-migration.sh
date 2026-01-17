#!/bin/bash

# ============================================================================
# Deploy Lambda Migration Runner and Run Instant Tele Queue Migration
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$PROJECT_ROOT/backend/lambda-migration-runner"
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-dev-migration-runner}"
REGION="${AWS_REGION:-ap-south-1}"

echo "🚀 Deploying Lambda Migration Runner and Running Migration..."
echo ""

cd "$LAMBDA_DIR"

# Check if zip is available
if ! command -v zip &> /dev/null; then
    echo "❌ Error: zip command not found"
    echo "   Please install zip utility"
    exit 1
fi

# Package Lambda function
echo "📦 Packaging Lambda function..."
rm -f function.zip
zip -r function.zip . -x "*.git*" "node_modules/.cache/*" "*.log" > /dev/null
echo "✅ Package created: function.zip"

# Deploy to Lambda
echo ""
echo "🚀 Deploying to Lambda..."
echo "   Function: $FUNCTION_NAME"
echo "   Region: $REGION"

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --zip-file fileb://function.zip \
  --output json > /tmp/lambda-update.json

if [ $? -eq 0 ]; then
    echo "✅ Lambda function updated successfully"
    
    # Wait for update to complete
    echo "⏳ Waiting for Lambda update to complete..."
    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION"
    
    echo "✅ Lambda is ready"
else
    echo "❌ Failed to update Lambda function"
    exit 1
fi

# Invoke migration
echo ""
echo "🔄 Invoking migration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --payload '{"migrationType": "instant-tele-queue"}' \
  --log-type Tail \
  /tmp/migration-response.json

# Get response
echo ""
echo "📋 Migration Response:"
cat /tmp/migration-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/migration-response.json

# Check for errors
if grep -q '"statusCode": 200' /tmp/migration-response.json; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Check CloudWatch logs for details:"
    echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
else
    echo ""
    echo "⚠️  Migration may have failed. Check the response above."
    echo ""
    echo "📋 View CloudWatch logs:"
    echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
fi

# Cleanup
rm -f function.zip

echo ""
echo "✅ Done!"

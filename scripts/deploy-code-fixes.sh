#!/bin/bash
# ============================================================================
# DEPLOY CODE FIXES
# ============================================================================
# Deploys Lambda code fixes for test coverage improvements
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"

echo "🚀 Deploying Code Fixes"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if serverless is available
if ! command -v serverless &> /dev/null; then
  echo "⚠️  serverless CLI not found. Attempting to use AWS CLI directly..."
  
  # Alternative: Use AWS CLI to update Lambda function code
  # This requires the function name and zip file
  echo "   Using AWS CLI for deployment..."
  echo "   Note: This requires manual Lambda function update"
  echo "   Files modified:"
  echo "     - backend/lambda/src/endpoints/service-discovery.ts"
  echo "     - backend/lambda/src/endpoints/wallet.ts"
  echo "     - backend/lambda/src/endpoints/analytics.ts"
  echo ""
  echo "   To deploy manually:"
  echo "     1. Build Lambda package"
  echo "     2. Update Lambda function code via AWS Console or CLI"
  echo ""
  exit 0
fi

# Navigate to backend directory
cd backend

if [ -f "serverless.yml" ] || [ -f "serverless.yaml" ]; then
  echo "📦 Deploying with serverless..."
  serverless deploy --stage "$ENVIRONMENT"
  echo "✅ Deployment complete"
else
  echo "⚠️  serverless.yml not found in backend directory"
  echo "   Code fixes are ready in source files:"
  echo "     - backend/lambda/src/endpoints/service-discovery.ts"
  echo "     - backend/lambda/src/endpoints/wallet.ts"
  echo "     - backend/lambda/src/endpoints/analytics.ts"
  echo ""
  echo "   Please deploy using your standard deployment process"
fi

cd ..

echo ""
echo "✅ Code fixes ready for deployment"
echo "   Next: Execute migrations and re-run tests"

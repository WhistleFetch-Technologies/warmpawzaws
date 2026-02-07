#!/bin/bash
# ============================================================================
# Deploy Lambda with Fixed Dependencies
# ============================================================================
# This script rebuilds and redeploys the Lambda function with all dependencies
# properly bundled to fix the "Cannot find module 'hono'" and "Cannot find module 'pg-types'" errors
# ============================================================================

set -e

STAGE=${1:-dev}
REGION=${2:-ap-south-1}

echo "🔧 Building Lambda with bundled dependencies..."
cd backend/lambda
npm run build

echo "📦 Checking bundle size..."
ls -lh dist/handler.js api-handler.zip

echo "🚀 Deploying to ${STAGE} environment in ${REGION}..."
npx serverless deploy --stage ${STAGE} --region ${REGION} --verbose

echo "✅ Deployment complete!"
echo ""
echo "🧪 Testing endpoint..."
sleep 5
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health" \
  -H "Origin: https://d2aoyjj8ine0wk.cloudfront.net" || echo "Health check failed"

echo ""
echo "📊 Check CloudWatch logs:"
echo "aws logs tail /aws/lambda/warmpawz-${STAGE}-api-handler --follow"

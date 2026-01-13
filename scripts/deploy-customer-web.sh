#!/bin/bash
# Direct AWS CLI deployment script for customer-web
# Usage: ./scripts/deploy-customer-web.sh

set -e

echo "🚀 Deploying customer-web to AWS dev environment..."

# Configuration
APP_NAME="customer-web"
S3_BUCKET="warmpawz-dev-customer-frontend-ap-south-1"
CLOUDFRONT_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName==\`${S3_BUCKET}.s3.ap-south-1.amazonaws.com\`]].Id" \
  --output text | awk '{print $1}' | head -1)

if [ -z "$CLOUDFRONT_DIST_ID" ] || [ "$CLOUDFRONT_DIST_ID" = "None" ]; then
  echo "❌ Error: Could not find CloudFront distribution for ${S3_BUCKET}"
  exit 1
fi

CLOUDFRONT_URL=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Id==\`${CLOUDFRONT_DIST_ID}\`].DomainName" \
  --output text | awk '{print $1}' | head -1)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Build the app
echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
cd "apps/${APP_NAME}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 1.5: Inject runtime-config.js
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"

# Get API Gateway endpoint
API_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 \
  --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -z "$API_ENDPOINT" ] || [ "$API_ENDPOINT" = "None" ]; then
  API_ENDPOINT="${DEV_API_URL:-https://dev.api.warmpawz.com}"
  echo -e "${YELLOW}⚠️  Using fallback API endpoint: $API_ENDPOINT${NC}"
else
  echo -e "${GREEN}✅ API Gateway endpoint: $API_ENDPOINT${NC}"
fi

# Inject runtime-config.js into dist folder
cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME}
// Injected at deployment time with actual API Gateway endpoint
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_ENDPOINT}",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF

echo -e "${GREEN}✅ runtime-config.js injected${NC}"

# Step 2: Deploy to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" --delete --exclude "*.map"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${YELLOW}❌ Error: S3 upload failed!${NC}"
  exit 1
fi

# Step 3: Invalidate CloudFront cache
echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DIST_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
  echo -e "${YELLOW}⏳ Full propagation may take 5-15 minutes${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: CloudFront invalidation failed (but files are uploaded)${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DIRECT AWS DEPLOYMENT COMPLETED                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Deployment Summary:"
echo -e "   ✅ ${APP_NAME}: Built successfully"
echo -e "   ✅ S3 Upload: Synced to ${S3_BUCKET}"
echo -e "   ✅ CloudFront: Cache invalidation created (${CLOUDFRONT_DIST_ID})"
echo ""
echo -e "🌐 Access URLs:"
echo -e "   - Customer Web: ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""


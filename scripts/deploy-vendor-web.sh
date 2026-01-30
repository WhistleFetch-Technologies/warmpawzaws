#!/bin/bash
# Direct AWS CLI deployment script for vendor-web
# Usage: ./scripts/deploy-vendor-web.sh

set -e

echo "🚀 Deploying vendor-web to AWS dev environment..."

# Configuration - ONLY use official Vendor CloudFront URL
APP_NAME="vendor-web"
S3_BUCKET="warmpawz-dev-vendor-frontend-ap-south-1"
# Official Vendor CloudFront (ONLY this URL for vendor component)
CLOUDFRONT_DIST_ID="E95171GX1I6HN"
CLOUDFRONT_URL="https://d1s6ykkj381k58.cloudfront.net"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build the app
echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT/apps/${APP_NAME}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 1.5: Inject runtime-config.js
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"

# Get API Gateway endpoint (HTTP API v2)
# The warmpawz API is an HTTP API (v2), so we use apigatewayv2
API_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 \
  --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -n "$API_ENDPOINT" ] && [ "$API_ENDPOINT" != "None" ]; then
  echo -e "${GREEN}✅ API Gateway endpoint: $API_ENDPOINT${NC}"
else
  # Fallback to known API Gateway endpoint
  API_ENDPOINT="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
  echo -e "${YELLOW}⚠️  Using fallback API endpoint: $API_ENDPOINT${NC}"
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
echo -e "   - Vendor Web: ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""


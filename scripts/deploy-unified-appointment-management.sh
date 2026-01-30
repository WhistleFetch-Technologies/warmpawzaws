#!/bin/bash
# Deploy Unified Appointment Management Component (Vendor Web)
# This script deploys the UniversalAppointmentManagement component to vendor-web
# Usage: ./scripts/deploy-unified-appointment-management.sh

set -e

echo "🚀 Deploying Unified Appointment Management Component (Vendor Web)..."
echo "======================================================================"
echo ""

# Configuration
APP_NAME="vendor-web"
S3_BUCKET="warmpawz-dev-vendor-frontend-ap-south-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Verify component exists
COMPONENT_PATH="apps/${APP_NAME}/components/shared/UniversalAppointmentManagement.tsx"
if [ ! -f "$COMPONENT_PATH" ]; then
    echo -e "${RED}❌ Error: Component not found at ${COMPONENT_PATH}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Component found: ${COMPONENT_PATH}${NC}"

# Get CloudFront distribution ID
echo -e "${BLUE}📡 Getting CloudFront distribution...${NC}"
CLOUDFRONT_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName==\`${S3_BUCKET}.s3.ap-south-1.amazonaws.com\`]].Id" \
  --output text 2>/dev/null | awk '{print $1}' | head -1 || echo "")

if [ -z "$CLOUDFRONT_DIST_ID" ] || [ "$CLOUDFRONT_DIST_ID" = "None" ]; then
  echo -e "${YELLOW}⚠️  Could not find CloudFront distribution for ${S3_BUCKET}${NC}"
  echo -e "${YELLOW}   Continuing with build only...${NC}"
  CLOUDFRONT_DIST_ID=""
else
  CLOUDFRONT_URL=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Id==\`${CLOUDFRONT_DIST_ID}\`].DomainName" \
    --output text 2>/dev/null | awk '{print $1}' | head -1 || echo "")
  echo -e "${GREEN}✅ CloudFront Distribution: ${CLOUDFRONT_DIST_ID}${NC}"
  echo -e "${GREEN}   URL: ${CLOUDFRONT_URL}${NC}"
fi

# Step 1: Build the app
echo ""
echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
cd "apps/${APP_NAME}"

# Clean stale build artifacts
echo -e "${BLUE}🧹 Cleaning stale build artifacts...${NC}"
rm -rf .next dist node_modules/.cache

# Build
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: dist directory not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 2: Inject runtime-config.js
echo ""
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"

# Get API Gateway endpoint
API_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 \
  --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -z "$API_ENDPOINT" ] || [ "$API_ENDPOINT" = "None" ]; then
  API_ENDPOINT="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
  echo -e "${YELLOW}⚠️  Using fallback API endpoint: $API_ENDPOINT${NC}"
else
  echo -e "${GREEN}✅ API Gateway endpoint: $API_ENDPOINT${NC}"
fi

# Inject runtime-config.js
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

# Step 3: Deploy to S3
echo ""
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"

# Upload all files except HTML with long cache
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" \
  --delete \
  --exclude "*.map" \
  --exclude "*.html" \
  --exclude "*.txt" \
  --cache-control "public, max-age=31536000, immutable"

# Upload HTML files with no-cache
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" \
  --exclude "*" \
  --include "*.html" \
  --include "*.txt" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${RED}❌ Error: S3 upload failed!${NC}"
  exit 1
fi

# Step 4: Invalidate CloudFront cache
if [ -n "$CLOUDFRONT_DIST_ID" ]; then
  echo ""
  echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DIST_ID}" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text 2>/dev/null || echo "")

  if [ -n "$INVALIDATION_ID" ]; then
    echo -e "${GREEN}✅ CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
    echo -e "${BLUE}   Cache invalidation in progress...${NC}"
  else
    echo -e "${YELLOW}⚠️  Could not create CloudFront invalidation${NC}"
  fi
fi

# Step 5: Summary
echo ""
echo -e "${GREEN}✅ ✅ ✅ UNIFIED APPOINTMENT MANAGEMENT DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "   Component: UniversalAppointmentManagement"
echo -e "   Location: apps/${APP_NAME}/components/shared/"
echo -e "   S3 Bucket: ${S3_BUCKET}"
if [ -n "$CLOUDFRONT_URL" ]; then
  echo -e "   CloudFront URL: https://${CLOUDFRONT_URL}"
fi
echo -e "   API Endpoint: ${API_ENDPOINT}"
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""

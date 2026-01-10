#!/bin/bash
# Direct AWS CLI deployment script for admin-web
# Usage: ./scripts/deploy-admin-web.sh

set -e

echo "🚀 Deploying admin-web to AWS dev environment..."

# Configuration
APP_NAME="admin-web"
S3_BUCKET="warmpawz-dev-admin-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E1WPXL8WBOWOE8"
CLOUDFRONT_URL="https://dfof7mguaa0a5.cloudfront.net"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build the app
echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
cd "$(dirname "$0")/.."
cd "apps/${APP_NAME}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 2: Deploy to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
cd "$(dirname "$0")/../.."
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
echo -e "   ✅ CloudFront: Cache invalidation created"
echo ""
echo -e "🌐 Access URLs:"
echo -e "   - Admin Web: ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""
echo -e "⏰ Next Steps:"
echo -e "   1. Wait 5-15 minutes for CloudFront propagation"
echo -e "   2. Test the deployed fix at ${CLOUDFRONT_URL}"
echo -e "   3. Verify issues are resolved"
echo ""


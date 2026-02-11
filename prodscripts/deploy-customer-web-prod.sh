#!/bin/bash
# Direct AWS CLI deployment script for customer-web (PRODUCTION)
# Usage: ./prodscripts/deploy-customer-web-prod.sh [--deploy-only]
#   --deploy-only  Skip build; inject config and upload existing dist (fails if dist missing).
#
# ⚠️  WARNING: This script deploys to PRODUCTION environment!
# Make sure you have tested in dev/staging before running this.

set -e

# Only skip build when explicitly requested via flag
DEPLOY_ONLY=false
SKIP_CONFIRM=false
for arg in "$@"; do
  if [ "$arg" = "--deploy-only" ] || [ "$arg" = "--skip-build" ]; then
    DEPLOY_ONLY=true
  fi
  if [ "$arg" = "--yes" ] || [ "$arg" = "-y" ]; then
    SKIP_CONFIRM=true
  fi
done

# Safety confirmation for PROD (skip if --yes flag is provided)
if [ "$SKIP_CONFIRM" = false ]; then
  echo "⚠️  ⚠️  ⚠️  WARNING: PRODUCTION DEPLOYMENT ⚠️  ⚠️  ⚠️"
  echo "This will deploy customer-web to PRODUCTION environment!"
  echo ""
  read -p "Are you sure you want to continue? Type 'yes' to proceed: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
fi

echo "🚀 Deploying customer-web to AWS PRODUCTION environment..."

# Production Configuration (from AWS CLI queries)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="customer-web"
S3_BUCKET="warmpawz-prod-customer-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E2F29N49KVOOBP"
CLOUDFRONT_URL="https://dg69gqp2frh39.cloudfront.net"
API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verify API endpoint
if [ -z "$API_BASE_URL" ]; then
  echo -e "${YELLOW}⚠️  Getting API endpoint from AWS...${NC}"
  API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1 || echo "")
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    echo -e "${RED}❌ Error: Could not get API Gateway endpoint${NC}"
    exit 1
  fi
fi
API_BASE_URL="${API_BASE_URL%/}"

echo -e "${BLUE}📋 Production Configuration:${NC}"
echo -e "   S3 Bucket: ${S3_BUCKET}"
echo -e "   CloudFront ID: ${CLOUDFRONT_DIST_ID}"
echo -e "   CloudFront URL: ${CLOUDFRONT_URL}"
echo -e "   API Endpoint: ${API_BASE_URL}"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Build the app (skip only when --deploy-only was passed and dist exists)
cd "apps/${APP_NAME}"
if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
  # Clean stale build artifacts to prevent ENOENT / manifest race conditions
  echo -e "${BLUE}🧹 Cleaning stale build artifacts...${NC}"
  rm -rf .next dist node_modules/.cache
  sleep 2

  # Build with retry on failure (Next.js static export can be flaky)
  if ! npm run build; then
    echo -e "${YELLOW}⚠️  First build failed, retrying with full clean...${NC}"
    rm -rf .next dist node_modules/.cache
    sleep 3
    npm run build
  fi

  if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

# Step 1.5: Inject runtime-config.js with API Gateway URL
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"

# Inject runtime-config.js into dist folder
cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME} (PRODUCTION)
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: false,
    environment: "production"
  };
  console.log('🔧 Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF

echo -e "${GREEN}✅ runtime-config.js injected (apiBaseUrl -> API Gateway)${NC}"

# Step 2: Deploy to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" --delete --exclude "*.map"

# ✅ FIX: Explicitly upload runtime-config.js with no-cache headers to prevent browser caching
echo -e "${BLUE}📤 Uploading runtime-config.js with no-cache headers...${NC}"
aws s3 cp "apps/${APP_NAME}/dist/runtime-config.js" "s3://${S3_BUCKET}/runtime-config.js" \
  --content-type "application/javascript" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${RED}❌ Error: S3 upload failed!${NC}"
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
echo -e "${GREEN}║   ✅ PRODUCTION DEPLOYMENT COMPLETED                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Deployment Summary:"
echo -e "   ✅ ${APP_NAME}: Built successfully"
echo -e "   ✅ S3 Upload: Synced to ${S3_BUCKET}"
echo -e "   ✅ CloudFront: Cache invalidation created (${INVALIDATION_ID})"
echo ""
echo -e "🌐 Access URLs:"
echo -e "   - Customer Web (PROD): ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""
echo -e "⏰ Next Steps:"
echo -e "   1. Wait 5-15 minutes for CloudFront propagation"
echo -e "   2. Test the deployed application at ${CLOUDFRONT_URL}"
echo -e "   3. Verify all features work correctly in production"
echo ""

#!/bin/bash
# Direct AWS CLI deployment script for admin-web
# Usage: ./scripts/deploy-admin-web.sh [--deploy-only]
#   --deploy-only  Skip build; use existing dist (fails if dist missing).
#   Default: always build. Do NOT use SKIP_BUILD env (ignored).

set -e

# Only skip build when explicitly requested via flag (ignore SKIP_BUILD env to avoid cross-agent leaks)
DEPLOY_ONLY=false
for arg in "$@"; do
  if [ "$arg" = "--deploy-only" ] || [ "$arg" = "--skip-build" ]; then
    DEPLOY_ONLY=true
    break
  fi
done

echo "🚀 Deploying admin-web to AWS dev environment..."

# Configuration: read from config/urls.json or env only (no hardcoded URLs)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="admin-web"
S3_BUCKET="warmpawz-dev-admin-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E1WPXL8WBOWOE8"
if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.admin // empty' "$PROJECT_ROOT/config/urls.json")}"
fi
CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build the app (skip only when --deploy-only was passed and dist exists)
cd "$PROJECT_ROOT/apps/${APP_NAME}"

if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
elif [ -d "dist-export" ] && [ ! -d "dist" ]; then
  echo -e "${BLUE}📦 Using existing dist-export as dist...${NC}"
  cp -R dist-export dist
  echo -e "${GREEN}✅ dist ready from dist-export${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
  npm run build
  if [ ! -d "dist" ]; then
    echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

# Step 1.5: Inject runtime-config.js with API Gateway URL (API calls must go to backend, not CloudFront)
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"
# Resolve API Gateway URL so /admin/categories, /admin/roles etc. hit the backend, not Admin CloudFront (which serves HTML)
# Prefer CDK outputs (source of truth for dev) to avoid wrong API from AWS CLI when multiple APIs exist
API_BASE_URL=""
CDK_OUTPUTS="$PROJECT_ROOT/infrastructure/cdk/cdk-outputs.json"
if [ -f "$CDK_OUTPUTS" ] && command -v jq &>/dev/null; then
  API_BASE_URL=$(jq -r '.["WarmpawzStack-dev"].ApiGatewayUrl // empty' "$CDK_OUTPUTS")
fi
if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
  if command -v aws &>/dev/null; then
    API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
      API_BASE_URL=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
    fi
    if [ -z "$API_BASE_URL" ]; then
      echo -e "${YELLOW}⚠️  API Gateway URL not found. Set in config/urls.json (apiGatewayDefaultUrl) or run CDK deploy first.${NC}"
      exit 1
    fi
    echo -e "${YELLOW}⚠️  Using API Gateway URL from config: $API_BASE_URL${NC}"
  else
    echo -e "${GREEN}✅ API Gateway endpoint (from AWS): $API_BASE_URL${NC}"
  fi
else
  echo -e "${GREEN}✅ API Gateway endpoint (from cdk-outputs.json): $API_BASE_URL${NC}"
fi
# Ensure no trailing slash
API_BASE_URL="${API_BASE_URL%/}"

# Inject runtime-config.js into dist folder
cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME}
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF

echo -e "${GREEN}✅ runtime-config.js injected (apiBaseUrl -> API Gateway)${NC}"

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


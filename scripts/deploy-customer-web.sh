#!/bin/bash
# Direct AWS CLI deployment script for customer-web
# Usage: ./scripts/deploy-customer-web.sh [--deploy-only]
#   --deploy-only  Skip build; inject config and upload existing dist (fails if dist missing).
#   Default: always clean + build, then inject + upload. Do NOT use SKIP_BUILD env (ignored).

set -e

# Only skip build when explicitly requested via flag (ignore SKIP_BUILD env to avoid cross-agent leaks)
DEPLOY_ONLY=false
for arg in "$@"; do
  if [ "$arg" = "--deploy-only" ] || [ "$arg" = "--skip-build" ]; then
    DEPLOY_ONLY=true
    break
  fi
done

echo "🚀 Deploying customer-web to AWS dev environment..."

# Configuration: read from config/urls.json or env only (no hardcoded URLs)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="customer-web"
S3_BUCKET="warmpawz-dev-customer-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E2RDORGXSWJJ87"
if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.customer // empty' "$PROJECT_ROOT/config/urls.json")}"
fi
CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
    echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

# Step 1.5: Inject runtime-config.js with API Gateway URL (API calls must go to backend, not CloudFront)
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"
# Customer app uses UAT (phone-based login). Use config/urls.json apiGatewayDefaultUrl - must be UAT-supporting API (z0b3obweb6).
# CDK API (rrg9107m3d) uses Cognito-only and returns 401 for UAT.
# Single source of truth: config/urls.json (no hardcoding).
API_BASE_URL=""
if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
  API_BASE_URL=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
fi
if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
  CDK_OUTPUTS="$PROJECT_ROOT/infrastructure/cdk/cdk-outputs.json"
  if [ -f "$CDK_OUTPUTS" ] && command -v jq &>/dev/null; then
    API_BASE_URL=$(jq -r '.["WarmpawzStack-dev"].ApiGatewayUrl // empty' "$CDK_OUTPUTS")
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
    if command -v aws &>/dev/null; then
      API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
    fi
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    echo -e "${YELLOW}⚠️  API Gateway URL not found. Set config/urls.json apiGatewayDefaultUrl.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}⚠️  Using fallback API: $API_BASE_URL${NC}"
else
  echo -e "${GREEN}✅ API Gateway (from config/urls.json): $API_BASE_URL${NC}"
fi
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

# Step 1.6: Replace inline runtime-config in all HTML files
echo -e "${BLUE}🔧 Replacing inline runtime-config in HTML files...${NC}"
INLINE_CONFIG="window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '${API_BASE_URL}', uatMode: true, environment: 'development' };"
HTML_COUNT=0
find "apps/${APP_NAME}/dist" -name "*.html" -type f | while read -r htmlfile; do
  if grep -q 'runtime-config-inline' "$htmlfile"; then
    sed -i "s|window.__WARMPAWZ_RUNTIME_CONFIG__ = {[^}]*};|${INLINE_CONFIG}|g" "$htmlfile"
    HTML_COUNT=$((HTML_COUNT + 1))
  fi
done
echo -e "${GREEN}✅ Inline runtime-config replaced in HTML files${NC}"

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


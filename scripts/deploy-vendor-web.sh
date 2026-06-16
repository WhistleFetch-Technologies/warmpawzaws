#!/bin/bash
# Direct AWS CLI deployment script for vendor-web
# Usage: ./scripts/deploy-vendor-web.sh [--deploy-only] [--prod] [--yes]
#   --deploy-only  Skip build; inject config and upload existing dist (fails if dist missing).
#   --prod         Deploy to PRODUCTION (S3 + CloudFront prod, prod HTTP API).
#   --yes, -y      Skip confirmation prompt when using --prod.

set -e

# Parse flags
DEPLOY_ONLY=false
PROD=false
SKIP_CONFIRM=false
for arg in "$@"; do
  case "$arg" in
    --deploy-only|--skip-build) DEPLOY_ONLY=true ;;
    --prod)                     PROD=true ;;
    --yes|-y)                   SKIP_CONFIRM=true ;;
  esac
done

if [ "${ENVIRONMENT:-}" = "prod" ]; then
  PROD=true
fi

# Configuration: read from config/urls.json or env only (no hardcoded URLs)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="vendor-web"

if [ "$PROD" = true ]; then
  echo "🚀 Deploying vendor-web to AWS PRODUCTION environment..."
  S3_BUCKET="warmpawz-prod-vendor-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E3JDHOY1XIFOWE"
  CLOUDFRONT_URL="https://d1y5ywletev82x.cloudfront.net"
  API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
  if [ "$SKIP_CONFIRM" = false ]; then
    echo "⚠️  WARNING: This will deploy vendor-web to PRODUCTION!"
    read -p "Type 'yes' to proceed: " confirm
    if [ "$confirm" != "yes" ]; then
      echo "❌ Deployment cancelled"
      exit 1
    fi
  fi
else
  echo "🚀 Deploying vendor-web to AWS dev environment..."
  S3_BUCKET="warmpawz-dev-vendor-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E95171GX1I6HN"
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.vendor // empty' "$PROJECT_ROOT/config/urls.json")}"
  fi
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"
  API_BASE_URL=""
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd "$PROJECT_ROOT"

# Step 1: Build the app (skip only when --deploy-only and dist exists)
cd "apps/${APP_NAME}"
if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME} (static export)...${NC}"
  ENABLE_STATIC_EXPORT=true npm run build
  if [ ! -d "dist" ]; then
    echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

# Step 1.5: Inject runtime-config.js with API Gateway URL (API calls must go to backend, not CloudFront)
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"
if [ "$PROD" = false ] && [ -z "$API_BASE_URL" ]; then
  # Priority: config/urls.json apiGatewayDefaultUrl (main API) → AWS query → fallback
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    API_BASE_URL=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
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
        echo -e "${YELLOW}❌ Set API_BASE_URL or ensure config/urls.json has apiGatewayDefaultUrl${NC}"
        exit 1
      fi
      echo -e "${YELLOW}⚠️  Using API URL from config/urls.json: $API_BASE_URL${NC}"
    else
      echo -e "${GREEN}✅ API Gateway endpoint (from AWS): $API_BASE_URL${NC}"
    fi
  else
    echo -e "${GREEN}✅ API Gateway endpoint (from config/urls.json): $API_BASE_URL${NC}"
  fi
elif [ "$PROD" = true ] && { [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; }; then
  if command -v aws &>/dev/null; then
    API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
  fi
  echo -e "${GREEN}✅ API Gateway endpoint (prod): $API_BASE_URL${NC}"
fi
# Ensure no trailing slash
API_BASE_URL="${API_BASE_URL%/}"

# Inject runtime-config.js into dist folder
if [ "$PROD" = true ]; then
  cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME} (PRODUCTION)
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: false,
    environment: "production",
    firebaseApiKey:            "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
    firebaseAuthDomain:        "warmpawz-b9baf.firebaseapp.com",
    firebaseProjectId:         "warmpawz-b9baf",
    firebaseStorageBucket:     "warmpawz-b9baf.firebasestorage.app",
    firebaseMessagingSenderId: "771876271254",
    firebaseAppId:             "1:771876271254:web:3191a5c001b269f2f1beb7",
    firebaseMeasurementId:     "G-PYF54Y34BP"
  };
  console.log('🔧 Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
else
  cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME}
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: true,
    firebaseApiKey:            "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
    firebaseAuthDomain:        "warmpawz-b9baf.firebaseapp.com",
    firebaseProjectId:         "warmpawz-b9baf",
    firebaseStorageBucket:     "warmpawz-b9baf.firebasestorage.app",
    firebaseMessagingSenderId: "771876271254",
    firebaseAppId:             "1:771876271254:web:3191a5c001b269f2f1beb7",
    firebaseMeasurementId:     "G-PYF54Y34BP"
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
fi

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

# Step 2.5: Set short cache on ALL HTML + runtime-config so route shells (e.g. services.html, settings.html)
# revalidate after deploy — avoids "Loading chunk N failed" on Android WebView / direct deep links.
echo -e "${BLUE}📄 Setting cache headers on HTML and runtime-config...${NC}"
if [ -f "apps/${APP_NAME}/dist/runtime-config.js" ]; then
  aws s3 cp "apps/${APP_NAME}/dist/runtime-config.js" "s3://${S3_BUCKET}/runtime-config.js" \
    --cache-control "public, max-age=0, must-revalidate" --content-type "application/javascript" 2>/dev/null || true
fi
find "apps/${APP_NAME}/dist" -name '*.html' -type f | while read -r html; do
  rel="${html#apps/${APP_NAME}/dist/}"
  aws s3 cp "$html" "s3://${S3_BUCKET}/${rel}" \
    --cache-control "public, max-age=0, must-revalidate" --content-type "text/html" 2>/dev/null || true
done
echo -e "${GREEN}✅ Cache headers set (all HTML + runtime-config revalidate; chunks remain long-cached)${NC}"

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
if [ "$PROD" = true ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ VENDOR-WEB PRODUCTION DEPLOYMENT COMPLETED               ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ DIRECT AWS DEPLOYMENT COMPLETED                          ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
fi
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
echo -e "${BLUE}💡 If you see \"Unexpected token '<'\" for .js files: ensure CloudFront has a behavior for /_next/* that does NOT return index.html for 404 (see docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md).${NC}"
echo ""


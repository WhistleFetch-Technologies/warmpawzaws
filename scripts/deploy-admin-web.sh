#!/bin/bash
# Direct AWS CLI deployment script for admin-web
# Usage: ./scripts/deploy-admin-web.sh [--deploy-only] [--prod] [--yes]
#   --deploy-only  Skip build; use existing dist (fails if dist missing).
#   --prod         Deploy to PRODUCTION (S3 + CloudFront prod).
#   --yes, -y      Skip confirmation prompt when using --prod.
#   Default: deploy to dev. Do NOT use SKIP_BUILD env (ignored).
#
# Verify prod API URL before deploying: aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text
# Prod must point at warmpawz-prod-api (mss9sa4y01); dev at warmpawz-dev-api (z0b3obweb6).
#
# This script only: builds, uploads to S3, and creates a CloudFront invalidation.
# It does NOT modify CloudFront distribution config (aliases/SSL). Protected URLs
# (dev.admin.warmpawz.com, admin.warmpawz.com) require aliases/SSL to be set via
# ./scripts/fix-cloudfront-ssl-dev-prod.sh if they show SSL errors.

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

# Support ENVIRONMENT=prod as alternative to --prod
if [ "${ENVIRONMENT:-}" = "prod" ]; then
  PROD=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="admin-web"

if [ "$PROD" = true ]; then
  echo "🚀 Deploying admin-web to AWS PRODUCTION environment..."
  S3_BUCKET="warmpawz-prod-admin-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E2NHO6UUI5UIHW"
  CLOUDFRONT_URL="https://dbr09zyoq9akb.cloudfront.net"
  # Resolve prod API from AWS first so prod never points at dev
  API_BASE_URL=""
  if [ "$SKIP_CONFIRM" = false ]; then
    echo "⚠️  WARNING: This will deploy to PRODUCTION!"
    read -p "Type 'yes' to proceed: " confirm
    if [ "$confirm" != "yes" ]; then
      echo "❌ Deployment cancelled"
      exit 1
    fi
  fi
else
  echo "🚀 Deploying admin-web to AWS dev environment..."
  S3_BUCKET="warmpawz-dev-admin-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E1WPXL8WBOWOE8"
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.admin // empty' "$PROJECT_ROOT/config/urls.json")}"
  fi
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"
  API_BASE_URL=""
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resolve API_BASE_URL BEFORE build so we can bake correct env into the build
if [ "$PROD" = true ]; then
  if command -v aws &>/dev/null; then
    API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
    echo -e "${YELLOW}⚠️  Could not resolve prod API from AWS; using fallback. Verify with: aws apigatewayv2 get-apis --region ap-south-1 --query \"Items[?Name=='warmpawz-prod-api'].ApiEndpoint\" --output text${NC}"
  fi
  # Safety: never deploy prod build pointing at dev API
  if echo "$API_BASE_URL" | grep -qE 'z0b3obweb6|rrg9107m3d'; then
    echo -e "${YELLOW}❌ ERROR: Prod API URL resolved to a DEV endpoint. Aborting.${NC}"
    echo -e "   Resolved: $API_BASE_URL"
    echo -e "   Expected: warmpawz-prod-api (mss9sa4y01...). Check AWS API Gateway."
    exit 1
  fi
  echo -e "${GREEN}✅ PROD API Gateway: $API_BASE_URL${NC}"
else
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
    if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
      API_BASE_URL=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
    fi
    if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
      if command -v aws &>/dev/null; then
        API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
      fi
    fi
    if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
      echo -e "${YELLOW}❌ DEV API Gateway URL not found. Set config/urls.json or ensure warmpawz-dev-api exists.${NC}"
      exit 1
    fi
  fi
  echo -e "${GREEN}✅ DEV API Gateway: $API_BASE_URL${NC}"
fi
API_BASE_URL="${API_BASE_URL%/}"

# Step 1: Build the app with TARGET environment baked in (no cross-contamination)
cd "$PROJECT_ROOT/apps/${APP_NAME}"

if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
elif [ -d "dist-export" ] && [ ! -d "dist" ]; then
  echo -e "${BLUE}📦 Using existing dist-export as dist...${NC}"
  cp -R dist-export dist
  echo -e "${GREEN}✅ dist ready from dist-export${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME} for $([ "$PROD" = true ] && echo 'PROD' || echo 'DEV') (API: ${API_BASE_URL})...${NC}"
  # Clean .next and dist so we never reuse the other environment's cached build
  rm -rf .next dist
  # CRITICAL: Bake correct API URL and environment into the build so PROD never gets dev URL
  export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
  if [ "$PROD" = true ]; then
    export NEXT_PUBLIC_ENVIRONMENT="production"
    export NEXT_PUBLIC_UAT_MODE="false"
  else
    export NEXT_PUBLIC_ENVIRONMENT="development"
    export NEXT_PUBLIC_UAT_MODE="true"
  fi
  npm run build
  if [ ! -d "dist" ]; then
    echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Build completed successfully (baked: $NEXT_PUBLIC_ENVIRONMENT, $NEXT_PUBLIC_API_BASE_URL)${NC}"
fi

# Step 1.5: Inject runtime-config.js (must match baked build: PROD vs DEV)
echo -e "${BLUE}🔧 Injecting runtime-config.js (${PROD:-false})...${NC}"
cd "$PROJECT_ROOT"

# Inject runtime-config.js into dist folder
if [ "$PROD" = true ]; then
  cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME} (PRODUCTION)
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: false,
    environment: "production"
  };
  console.log('🔧 Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
else
  cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME}
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
fi

echo -e "${GREEN}✅ runtime-config.js injected (apiBaseUrl -> API Gateway)${NC}"

# Safety: when deploying to prod, verify dist has prod API URL (not dev)
if [ "$PROD" = true ]; then
  RUNTIME_CONFIG="apps/${APP_NAME}/dist/runtime-config.js"
  if [ -f "$RUNTIME_CONFIG" ]; then
    if grep -qE 'z0b3obweb6|rrg9107m3d' "$RUNTIME_CONFIG"; then
      echo -e "${YELLOW}❌ ERROR: dist/runtime-config.js contains DEV API URL. Prod must not point at dev. Aborting.${NC}"
      exit 1
    fi
    if ! grep -q "mss9sa4y01" "$RUNTIME_CONFIG"; then
      echo -e "${YELLOW}❌ ERROR: dist/runtime-config.js does not contain prod API (mss9sa4y01). Aborting.${NC}"
      exit 1
    fi
    echo -e "${GREEN}✅ Verified runtime-config.js points at prod API${NC}"
  fi
fi

# Step 2: Deploy to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" --delete --exclude "*.map"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${YELLOW}❌ Error: S3 upload failed!${NC}"
  exit 1
fi

# Step 3: Invalidate CloudFront cache (deploy never modifies distribution config: aliases/SSL are unchanged)
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

# Protected URL (canonical custom domain; prefer over *.cloudfront.net)
PROTECTED_URL=""
if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
  if [ "$PROD" = true ]; then
    PROTECTED_URL=$(jq -r '.protectedUrls.prod.admin // empty' "$PROJECT_ROOT/config/urls.json")
  else
    PROTECTED_URL=$(jq -r '.protectedUrls.dev.admin // empty' "$PROJECT_ROOT/config/urls.json")
  fi
fi
PROTECTED_URL="${PROTECTED_URL:-$CLOUDFRONT_URL}"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
if [ "$PROD" = true ]; then
  echo -e "${GREEN}║   ✅ PRODUCTION DEPLOYMENT COMPLETED                           ║${NC}"
else
  echo -e "${GREEN}║   ✅ DIRECT AWS DEPLOYMENT COMPLETED (dev)                      ║${NC}"
fi
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📦 Deployment Summary:"
echo -e "   ✅ ${APP_NAME}: Built successfully"
echo -e "   ✅ S3 Upload: Synced to ${S3_BUCKET}"
echo -e "   ✅ CloudFront: Cache invalidation created (this script does not change aliases/SSL)"
echo ""
echo -e "🌐 Access URLs (use protected URL for HTTPS custom domain):"
echo -e "   - Admin Web: ${PROTECTED_URL}"
echo -e "   - Fallback:  ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""
echo -e "⏰ Next Steps:"
echo -e "   1. Wait 5-15 minutes for CloudFront propagation"
echo -e "   2. Test at ${PROTECTED_URL}"
echo -e "   3. If custom URL shows SSL errors: ./scripts/fix-cloudfront-ssl-dev-prod.sh $([ "$PROD" = true ] && echo '--prod-only' || echo '--dev-only')"
echo ""


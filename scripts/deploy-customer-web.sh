#!/bin/bash
# Direct AWS CLI deployment script for customer-web
# Usage: ./scripts/deploy-customer-web.sh [--deploy-only] [--prod] [--yes]
#   --deploy-only  Skip build; inject config and upload existing dist (fails if dist missing).
#   --prod         Deploy to PRODUCTION (S3 + CloudFront prod, prod API URL).
#   --yes, -y      Skip confirmation prompt when using --prod.
#   Default: deploy to dev. Correct API URL is set before build so PROD never gets dev URL.
#
# This script only: builds, uploads to S3, and creates a CloudFront invalidation.
# It does NOT modify CloudFront distribution config (aliases/SSL). Protected URLs
# (dev.customer.warmpawz.com, customer.warmpawz.com) require aliases/SSL via
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

if [ "${ENVIRONMENT:-}" = "prod" ]; then
  PROD=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="customer-web"

if [ "$PROD" = true ]; then
  echo "🚀 Deploying customer-web to AWS PRODUCTION environment..."
  S3_BUCKET="warmpawz-prod-customer-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E2F29N49KVOOBP"
  CLOUDFRONT_URL="https://dg69gqp2frh39.cloudfront.net"
  API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
  if [ "$SKIP_CONFIRM" = false ]; then
    echo "⚠️  WARNING: This will deploy to PRODUCTION!"
    read -p "Type 'yes' to proceed: " confirm
    if [ "$confirm" != "yes" ]; then
      echo "❌ Deployment cancelled"
      exit 1
    fi
  fi
else
  echo "🚀 Deploying customer-web to AWS dev environment..."
  S3_BUCKET="warmpawz-dev-customer-frontend-ap-south-1"
  CLOUDFRONT_DIST_ID="E2RDORGXSWJJ87"
  API_BASE_URL=""
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.customer // empty' "$PROJECT_ROOT/config/urls.json")}"
  fi
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resolve API_BASE_URL before build (so build is baked for correct environment)
if [ "$PROD" = true ]; then
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
    if command -v aws &>/dev/null; then
      API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
    fi
    if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
      API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
    fi
  fi
  echo -e "${GREEN}✅ PROD API Gateway: $API_BASE_URL${NC}"
else
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
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
    fi
    if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
      echo -e "${YELLOW}❌ DEV API Gateway URL not found. Set config/urls.json or ensure warmpawz-dev-api exists.${NC}"
      exit 1
    fi
  fi
  echo -e "${GREEN}✅ DEV API Gateway: $API_BASE_URL${NC}"
fi
API_BASE_URL="${API_BASE_URL%/}"

cd "$PROJECT_ROOT"

# Step 1: Build the app (skip only when --deploy-only and dist exists)
cd "apps/${APP_NAME}"
if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME} for $([ "$PROD" = true ] && echo 'PROD' || echo 'DEV') (API: ${API_BASE_URL})...${NC}"
  echo -e "${BLUE}🧹 Cleaning stale build artifacts...${NC}"
  rm -rf .next dist node_modules/.cache
  sleep 2
  export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
  if [ "$PROD" = true ]; then
    export NEXT_PUBLIC_ENVIRONMENT="production"
    export NEXT_PUBLIC_UAT_MODE="false"
  else
    export NEXT_PUBLIC_ENVIRONMENT="development"
    export NEXT_PUBLIC_UAT_MODE="true"
  fi
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
  echo -e "${GREEN}✅ Build completed successfully (baked: $NEXT_PUBLIC_ENVIRONMENT, $NEXT_PUBLIC_API_BASE_URL)${NC}"
fi

# Step 1.5: Inject runtime-config.js (must match target: PROD vs DEV)
echo -e "${BLUE}🔧 Injecting runtime-config.js ($([ "$PROD" = true ] && echo 'PROD' || echo 'DEV'))...${NC}"
cd "$PROJECT_ROOT"
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

# Step 2: Deploy to S3
echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" --delete --exclude "*.map"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${YELLOW}❌ Error: S3 upload failed!${NC}"
  exit 1
fi

# Step 2.5: Set short cache on HTML and config so CDN/browsers don't serve stale index (avoids "Unexpected token '<'" when chunk names change)
echo -e "${BLUE}📄 Setting cache headers on HTML and runtime-config...${NC}"
for f in index.html 404.html runtime-config.js; do
  if [ -f "apps/${APP_NAME}/dist/${f}" ]; then
    aws s3 cp "apps/${APP_NAME}/dist/${f}" "s3://${S3_BUCKET}/${f}" --cache-control "public, max-age=0, must-revalidate" --content-type "$( [ "${f%.html}" != "$f" ] && echo "text/html" || echo "application/javascript")" 2>/dev/null || true
  fi
done
echo -e "${GREEN}✅ Cache headers set${NC}"

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

# Protected URL (canonical custom domain)
PROTECTED_URL=""
if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
  if [ "$PROD" = true ]; then
    PROTECTED_URL=$(jq -r '.protectedUrls.prod.customer // empty' "$PROJECT_ROOT/config/urls.json")
  else
    PROTECTED_URL=$(jq -r '.protectedUrls.dev.customer // empty' "$PROJECT_ROOT/config/urls.json")
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
echo -e "   - Customer Web: ${PROTECTED_URL}"
echo -e "   - Fallback:  ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""
echo -e "⏰ If custom URL shows SSL errors: ./scripts/fix-cloudfront-ssl-dev-prod.sh $([ "$PROD" = true ] && echo '--prod-only' || echo '--dev-only')"
echo -e "${BLUE}💡 If you see \"Unexpected token '<'\" for .js files: hard-refresh (Ctrl+Shift+R) or ensure CloudFront does NOT serve index.html for 404 on /_next/*.${NC}"
echo ""


#!/bin/bash
# Direct AWS CLI deployment script for admin-web
# Usage: ./scripts/deploy-admin-web.sh [--deploy-only] [--prod] [--yes]
#   --deploy-only  Skip build; use existing dist (fails if dist missing).
#   --prod         Deploy to PRODUCTION (S3 + CloudFront prod).
#   --yes, -y      Skip confirmation prompt when using --prod.
#   Default: deploy to dev. Do NOT use SKIP_BUILD env (ignored).

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
if [ "$PROD" = false ] && [ -z "$API_BASE_URL" ]; then
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
      elif [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v node &>/dev/null; then
        API_BASE_URL=$(node -e "const fs=require('fs'); const p=process.argv[1]; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(j.apiGatewayDefaultUrl||'');" "$PROJECT_ROOT/config/urls.json")
      fi
    fi
  fi
  if [ -z "$API_BASE_URL" ]; then
    echo -e "${YELLOW}⚠️  API Gateway URL not found. Set in config/urls.json or run CDK deploy first.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ API Gateway endpoint (dev): $API_BASE_URL${NC}"
elif [ "$PROD" = true ] && { [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; }; then
  if command -v aws &>/dev/null; then
    API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1)
  fi
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "None" ]; then
    echo -e "${YELLOW}⚠️  Could not get prod API Gateway; using default.${NC}"
    API_BASE_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
  fi
  echo -e "${GREEN}✅ API Gateway endpoint (prod): $API_BASE_URL${NC}"
fi
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
    // Discount Engine V2 — prod cutover (authoritative modes live on Lambda env)
    discountEngineV2Enabled: true,
    discountEngineV2AnalyticsMode: "AUTHORITATIVE"
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
    uatMode: true,
    warmpawzAppointmentsAdminEnabled: true
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
echo -e "   ✅ CloudFront: Cache invalidation created"
echo ""
echo -e "🌐 Access URLs:"
echo -e "   - Admin Web: ${CLOUDFRONT_URL}"
echo -e "   - Direct S3: s3://${S3_BUCKET}"
echo ""
echo -e "⏰ Next Steps:"
echo -e "   1. Wait 5-15 minutes for CloudFront propagation"
echo -e "   2. Test at ${CLOUDFRONT_URL}"
echo ""


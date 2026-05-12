#!/bin/bash
# Direct AWS CLI deployment script for customer-web
# Usage: ./scripts/deploy-customer-web.sh [--deploy-only] [--prod] [--yes]
#   --deploy-only  Skip build; inject config and upload existing dist (fails if dist missing).
#   --prod         Deploy to PRODUCTION (S3 + CloudFront prod, prod HTTP API).
#   --yes, -y      Skip confirmation prompt when using --prod.
#   Default: deploy to dev. Do NOT use SKIP_BUILD env (ignored).

set -e

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
    echo "⚠️  WARNING: This will deploy customer-web to PRODUCTION!"
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
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    CLOUDFRONT_URL="${CLOUDFRONT_URL:-$(jq -r '.cloudfront.customer // empty' "$PROJECT_ROOT/config/urls.json")}"
  fi
  CLOUDFRONT_URL="${CLOUDFRONT_URL:-}"
  API_BASE_URL=""
fi

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$PROJECT_ROOT"

cd "apps/${APP_NAME}"
# Resolve API base URL up-front so we can pass NEXT_PUBLIC_* into the build
# (layout.tsx renders the correct inline runtime-config from these env vars,
# and the post-build sed substitution that used to corrupt the RSC payload is
# no longer needed).
if [ "$PROD" = true ]; then
  RESOLVED_API_BASE_URL="${API_BASE_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
  if command -v aws &>/dev/null; then
    AWS_RESOLVED=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-prod-api'].ApiEndpoint" --output text 2>/dev/null | head -1 || echo "")
    if [ -n "$AWS_RESOLVED" ] && [ "$AWS_RESOLVED" != "None" ]; then
      RESOLVED_API_BASE_URL="${AWS_RESOLVED%/}"
    fi
  fi
else
  RESOLVED_API_BASE_URL=""
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    RESOLVED_API_BASE_URL=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
  fi
  if [ -z "$RESOLVED_API_BASE_URL" ] || [ "$RESOLVED_API_BASE_URL" = "null" ]; then
    if command -v aws &>/dev/null; then
      RESOLVED_API_BASE_URL=$(aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" --output text 2>/dev/null | head -1 || echo "")
    fi
  fi
  if [ -z "$RESOLVED_API_BASE_URL" ] || [ "$RESOLVED_API_BASE_URL" = "None" ]; then
    RESOLVED_API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
  fi
fi
RESOLVED_API_BASE_URL="${RESOLVED_API_BASE_URL%/}"

# Customer marketplace toggle (default on). Resolve here so the build picks it
# up from the env, and the deploy-time runtime-config.js stays consistent.
CEE_RAW="${CUSTOMER_ECOMMERCE_ENABLED:-true}"
if [ "$CEE_RAW" = "true" ] || [ "$CEE_RAW" = "1" ]; then
  CEE_JS="true"
else
  CEE_JS="false"
fi

if [ "$DEPLOY_ONLY" = true ] && [ -d "dist" ]; then
  echo -e "${GREEN}✅ Skipping build (--deploy-only, dist exists)${NC}"
else
  echo -e "${BLUE}📦 Building ${APP_NAME}...${NC}"
  echo -e "${BLUE}🧹 Cleaning stale build artifacts...${NC}"
  rm -rf .next dist node_modules/.cache
  sleep 2

  # Pass NEXT_PUBLIC_* to npm so Next.js bakes the correct values into the
  # static export (HTML + RSC payload). Doing it here avoids the post-build
  # text surgery that previously broke the RSC JSON string and produced
  # "Uncaught SyntaxError: Unexpected identifier 'https'" on prod.
  if [ "$PROD" = true ]; then
    BUILD_ENV=(
      "NEXT_PUBLIC_ENVIRONMENT=production"
      "NEXT_PUBLIC_API_BASE_URL=${RESOLVED_API_BASE_URL}"
      "NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED=${CEE_JS}"
    )
  else
    BUILD_ENV=(
      "NEXT_PUBLIC_ENVIRONMENT=development"
      "NEXT_PUBLIC_API_BASE_URL=${RESOLVED_API_BASE_URL}"
      "NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED=${CEE_JS}"
    )
  fi

  if ! env "${BUILD_ENV[@]}" npm run build; then
    echo -e "${YELLOW}⚠️  First build failed, retrying with full clean...${NC}"
    rm -rf .next dist node_modules/.cache
    sleep 3
    env "${BUILD_ENV[@]}" npm run build
  fi

  if [ ! -d "dist" ]; then
    echo -e "${YELLOW}❌ Error: dist directory not found after build!${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Build completed successfully${NC}"
fi

echo -e "${BLUE}🔧 Writing runtime-config.js (external)...${NC}"
cd "$PROJECT_ROOT"

# `API_BASE_URL` is kept for downstream log lines that may reference it.
API_BASE_URL="${RESOLVED_API_BASE_URL}"

# The inline window.__WARMPAWZ_RUNTIME_CONFIG__ block is now baked into the
# HTML by Next.js at build time (see apps/customer-web/app/layout.tsx — guarded
# by NEXT_PUBLIC_ENVIRONMENT). We deliberately do NOT post-process HTML here:
# the previous `sed` substitution corrupted Next.js's RSC payload (the
# `self.__next_f.push([1, "..."])` JSON strings) by injecting unescaped quotes,
# which broke prod with `Uncaught SyntaxError: Unexpected identifier 'https'`
# and a white screen.

if [ "$PROD" = true ]; then
  cat > "apps/${APP_NAME}/dist/runtime-config.js" <<EOF
// Runtime Configuration for Warmpawz ${APP_NAME} (PRODUCTION)
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_BASE_URL}",
    uatMode: false,
    environment: "production",
    customerEcommerceEnabled: ${CEE_JS}
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
    environment: "development",
    customerEcommerceEnabled: ${CEE_JS}
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
EOF
fi

echo -e "${GREEN}✅ runtime-config.js written (apiBaseUrl -> ${API_BASE_URL})${NC}"

echo -e "${BLUE}🧭 Creating extensionless HTML route aliases...${NC}"
ALIAS_COUNT=0
while IFS= read -r htmlfile; do
  rel_path="${htmlfile#apps/${APP_NAME}/dist/}"
  alias_path="apps/${APP_NAME}/dist/${rel_path%.html}"
  # Skip root index aliasing; S3 website/index behavior handles root.
  if [ "$rel_path" = "index.html" ]; then
    continue
  fi
  cp "$htmlfile" "$alias_path"
  ALIAS_COUNT=$((ALIAS_COUNT + 1))
done < <(find "apps/${APP_NAME}/dist" -name "*.html" -type f)
echo -e "${GREEN}✅ Created ${ALIAS_COUNT} extensionless route aliases${NC}"

echo -e "${BLUE}📤 Uploading to S3 bucket: ${S3_BUCKET}...${NC}"
aws s3 sync "apps/${APP_NAME}/dist/" "s3://${S3_BUCKET}/" --delete --exclude "*.map"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ S3 upload completed successfully${NC}"
else
  echo -e "${YELLOW}❌ Error: S3 upload failed!${NC}"
  exit 1
fi

echo -e "${BLUE}🧩 Updating extensionless route content-types to text/html...${NC}"
HTML_ALIAS_UPDATED=0
while IFS= read -r aliasfile; do
  rel_path="${aliasfile#apps/${APP_NAME}/dist/}"
  aws s3 cp "$aliasfile" "s3://${S3_BUCKET}/${rel_path}" \
    --content-type "text/html; charset=utf-8" >/dev/null
  HTML_ALIAS_UPDATED=$((HTML_ALIAS_UPDATED + 1))
done < <(find "apps/${APP_NAME}/dist" -type f ! -name "*.*")
echo -e "${GREEN}✅ Updated content-type for ${HTML_ALIAS_UPDATED} extensionless routes${NC}"

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

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
if [ "$PROD" = true ]; then
  echo -e "${GREEN}║   ✅ CUSTOMER-WEB PRODUCTION DEPLOYMENT COMPLETED             ║${NC}"
else
  echo -e "${GREEN}║   ✅ DIRECT AWS DEPLOYMENT COMPLETED (dev)                    ║${NC}"
fi
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

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

# Configuration - ONLY official CloudFront URLs (do not create or discover new URLs)
# Official Customer: https://d2aoyjj8ine0wk.cloudfront.net
APP_NAME="customer-web"
S3_BUCKET="warmpawz-dev-customer-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E2RDORGXSWJJ87"
CLOUDFRONT_URL="https://d2aoyjj8ine0wk.cloudfront.net"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
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

# Step 1.5: Inject runtime-config.js
echo -e "${BLUE}🔧 Injecting runtime-config.js...${NC}"
cd "$PROJECT_ROOT"

# Get API endpoint. For Customer app with UAT mode (phone login, no Cognito):
# - Default USE_SERVERLESS_API=1 so POST /customer/profile and other customer routes work with UAT token (CDK api.dev.warmpawz.com uses Cognito-only → 401)
# - Set USE_SERVERLESS_API=0 to use api.dev.warmpawz.com (requires Cognito JWT)
USE_SERVERLESS_API="${USE_SERVERLESS_API:-1}"
SERVERLESS_API="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

if [ "$USE_SERVERLESS_API" = "1" ] || [ "$USE_SERVERLESS_API" = "true" ]; then
  API_ENDPOINT="$SERVERLESS_API"
  echo -e "${GREEN}✅ Using Serverless API (UAT-compatible): $API_ENDPOINT${NC}"
else
  CDK_OUT="$PROJECT_ROOT/infrastructure/cdk/cdk-outputs.json"
  if [ -f "$CDK_OUT" ]; then
    if command -v jq >/dev/null 2>&1; then
      API_DOMAIN=$(jq -r '.WarmpawzStack-dev.ApiDomainName // empty' "$CDK_OUT" 2>/dev/null)
      CDK_API_URL=$(jq -r '.WarmpawzStack-dev.ApiGatewayUrl // empty' "$CDK_OUT" 2>/dev/null | sed 's|/$||')
    else
      API_DOMAIN=$(grep -o '"ApiDomainName": "[^"]*"' "$CDK_OUT" 2>/dev/null | head -1 | sed 's/.*"ApiDomainName": "\([^"]*\)".*/\1/')
      CDK_API_URL=$(grep -o '"ApiGatewayUrl": "[^"]*"' "$CDK_OUT" 2>/dev/null | head -1 | sed 's/.*"ApiGatewayUrl": "\([^"]*\)".*/\1/' | sed 's|/$||')
    fi
    # Prefer official API domain (https://api.dev.warmpawz.com) when available
    if [ -n "$API_DOMAIN" ] && [ "$API_DOMAIN" != "null" ]; then
      API_ENDPOINT="https://${API_DOMAIN}"
      echo -e "${GREEN}✅ API endpoint (official domain): $API_ENDPOINT${NC}"
    elif [ -n "$CDK_API_URL" ] && [ "$CDK_API_URL" != "null" ]; then
      API_ENDPOINT="$CDK_API_URL"
      echo -e "${GREEN}✅ API Gateway endpoint: $API_ENDPOINT${NC}"
      echo -e "${YELLOW}   Note: CDK API uses Cognito auth. For UAT (phone login), set USE_SERVERLESS_API=1${NC}"
    fi
  fi
  if [ -z "$API_ENDPOINT" ]; then
    API_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 \
      --query "Items[?Name=='warmpawz-dev-api'].ApiEndpoint" \
      --output text 2>/dev/null | head -1 || echo "")
  fi
  if [ -z "$API_ENDPOINT" ] || [ "$API_ENDPOINT" = "None" ]; then
    API_ENDPOINT="$SERVERLESS_API"
    echo -e "${YELLOW}⚠️  Using fallback API (serverless, UAT-compatible): $API_ENDPOINT${NC}"
  fi
fi

# Inject runtime-config.js into dist folder
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


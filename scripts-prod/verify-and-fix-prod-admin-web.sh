#!/bin/bash
# Verify and fix production Admin Web (CloudFront + S3) accessibility.
# Run from repo root. Uses AWS CLI.
#
# Usage: ./scripts/verify-and-fix-prod-admin-web.sh [--invalidate]
#   --invalidate  Create CloudFront cache invalidation after checks.

set -e

DIST_ID="E2NHO6UUI5UIHW"
BUCKET="warmpawz-prod-admin-frontend-ap-south-1"
CF_DOMAIN="dbr09zyoq9akb.cloudfront.net"
ADMIN_URL="https://admin.warmpawz.com"
REGION="ap-south-1"

DO_INVALIDATE=false
for arg in "$@"; do
  [ "$arg" = "--invalidate" ] && DO_INVALIDATE=true
done

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 Prod Admin Web – verify CloudFront + S3${NC}"
echo ""

# 1. CloudFront distribution
echo -e "${BLUE}1. CloudFront distribution ${DIST_ID}${NC}"
CF_STATUS=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.Status' --output text 2>/dev/null || echo "NotFound")
if [ "$CF_STATUS" = "Deployed" ]; then
  echo -e "   ${GREEN}✅ Status: Deployed${NC}"
else
  echo -e "   ${YELLOW}⚠️  Status: ${CF_STATUS}${NC}"
fi

ORIGIN=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'DistributionConfig.Origins.Items[0].DomainName' --output text 2>/dev/null || echo "")
if [[ "$ORIGIN" == *"$BUCKET"* ]]; then
  echo -e "   ${GREEN}✅ Origin: ${ORIGIN} (matches bucket)${NC}"
else
  echo -e "   ${RED}❌ Origin: ${ORIGIN} (expected *${BUCKET}*)${NC}"
fi

ALIASES=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'DistributionConfig.Aliases.Items' --output text 2>/dev/null || echo "")
if [[ "$ALIASES" == *"admin.warmpawz.com"* ]]; then
  echo -e "   ${GREEN}✅ Alias: admin.warmpawz.com${NC}"
else
  echo -e "   ${YELLOW}⚠️  Aliases: ${ALIASES}${NC}"
fi
echo ""

# 2. S3 bucket and policy
echo -e "${BLUE}2. S3 bucket ${BUCKET}${NC}"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo -e "   ${GREEN}✅ Bucket exists and accessible${NC}"
else
  echo -e "   ${RED}❌ Cannot access bucket${NC}"
  exit 1
fi

POLICY=$(aws s3api get-bucket-policy --bucket "$BUCKET" 2>/dev/null | jq -r '.Policy' || echo "{}")
if echo "$POLICY" | grep -q "E2NHO6UUI5UIHW"; then
  echo -e "   ${GREEN}✅ Bucket policy allows CloudFront distribution ${DIST_ID}${NC}"
else
  echo -e "   ${RED}❌ Bucket policy may not allow CloudFront. Fix with:${NC}"
  echo "   aws s3api put-bucket-policy --bucket $BUCKET --policy file://..."
  exit 1
fi

if aws s3 ls "s3://${BUCKET}/index.html" >/dev/null 2>&1; then
  echo -e "   ${GREEN}✅ index.html present${NC}"
else
  echo -e "   ${RED}❌ index.html missing – run deploy${NC}"
  exit 1
fi
echo ""

# 3. Live URL check
echo -e "${BLUE}3. Live URL check${NC}"
HTTP=$(curl -sI -o /dev/null -w "%{http_code}" "$ADMIN_URL/" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  echo -e "   ${GREEN}✅ ${ADMIN_URL}/ → ${HTTP}${NC}"
else
  echo -e "   ${YELLOW}⚠️  ${ADMIN_URL}/ → ${HTTP}${NC}"
fi

JS_URL="${ADMIN_URL}/_next/static/chunks/vendors-314cf15e9fefb04c.js"
CT=$(curl -sI "$JS_URL" 2>/dev/null | grep -i content-type | head -1 || echo "")
if echo "$CT" | grep -qi "javascript"; then
  echo -e "   ${GREEN}✅ Static JS served with correct content-type${NC}"
else
  echo -e "   ${YELLOW}⚠️  JS chunk may be wrong type (cache?). Run with --invalidate${NC}"
fi
echo ""

# 4. Optional invalidation
if [ "$DO_INVALIDATE" = true ]; then
  echo -e "${BLUE}4. Creating CloudFront invalidation...${NC}"
  INV_ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --query 'Invalidation.Id' --output text 2>/dev/null)
  echo -e "   ${GREEN}✅ Invalidation created: ${INV_ID}${NC}"
  echo -e "   ${YELLOW}   Propagation can take 5–15 minutes${NC}"
else
  echo -e "${BLUE}4. Tip: run with --invalidate to clear CloudFront cache${NC}"
fi

echo ""
echo -e "${GREEN}Done. Prod admin: ${ADMIN_URL} | Direct CF: https://${CF_DOMAIN}${NC}"

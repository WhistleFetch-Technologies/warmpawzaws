#!/bin/bash
# Fix admin-web JavaScript errors - "Unexpected token '<'"
# This script diagnoses and fixes the issue where JS files return HTML

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="admin-web"
S3_BUCKET="warmpawz-prod-admin-frontend-ap-south-1"
CLOUDFRONT_DIST_ID="E2NHO6UUI5UIHW"
CLOUDFRONT_URL="https://dbr09zyooq9akb.cloudfront.net"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 Diagnosing admin-web JavaScript errors...${NC}"
echo ""

# Step 1: Check what JS files the HTML references
echo -e "${BLUE}1. Checking HTML file for referenced JavaScript files...${NC}"
HTML_CONTENT=$(aws s3 cp "s3://${S3_BUCKET}/index.html" - 2>/dev/null || echo "")

if [ -z "$HTML_CONTENT" ]; then
  echo -e "${RED}❌ Error: Could not fetch index.html from S3${NC}"
  exit 1
fi

# Extract JS file references
JS_FILES=$(echo "$HTML_CONTENT" | grep -oP 'src="[^"]*\.js[^"]*"' | sed 's/src="//g' | sed 's/"//g' | sed 's|^/||' | head -10)

echo -e "${YELLOW}   HTML references these JS files:${NC}"
echo "$JS_FILES" | while read -r js_file; do
  if [ -n "$js_file" ]; then
    echo -e "   - ${js_file}"
  fi
done

# Step 2: Check if these files exist in S3
echo ""
echo -e "${BLUE}2. Checking if referenced files exist in S3...${NC}"
MISSING_FILES=0

echo "$JS_FILES" | while read -r js_file; do
  if [ -n "$js_file" ]; then
    if aws s3 ls "s3://${S3_BUCKET}/${js_file}" > /dev/null 2>&1; then
      echo -e "   ${GREEN}✅${NC} ${js_file}"
    else
      echo -e "   ${RED}❌${NC} ${js_file} (MISSING)"
      MISSING_FILES=$((MISSING_FILES + 1))
    fi
  fi
done

# Step 3: Check CloudFront cache behaviors
echo ""
echo -e "${BLUE}3. Checking CloudFront cache behaviors...${NC}"
CACHE_BEHAVIORS=$(aws cloudfront get-distribution-config \
  --id "${CLOUDFRONT_DIST_ID}" \
  --query "DistributionConfig.CacheBehaviors.Items" \
  --output json 2>/dev/null || echo "[]")

HAS_NEXT_BEHAVIOR=$(echo "$CACHE_BEHAVIORS" | jq '[.[] | select(.PathPattern == "/_next/*")] | length' 2>/dev/null || echo "0")

if [ "$HAS_NEXT_BEHAVIOR" = "0" ]; then
  echo -e "${YELLOW}   ⚠️  No separate cache behavior for /_next/* paths${NC}"
  echo -e "${YELLOW}   This means 404s on /_next/* might return index.html${NC}"
else
  echo -e "${GREEN}   ✅ Separate cache behavior exists for /_next/*${NC}"
fi

# Step 4: Check custom error responses
echo ""
echo -e "${BLUE}4. Checking custom error responses...${NC}"
CUSTOM_ERRORS=$(aws cloudfront get-distribution-config \
  --id "${CLOUDFRONT_DIST_ID}" \
  --query "DistributionConfig.DefaultCacheBehavior.CustomErrorResponses.Items" \
  --output json 2>/dev/null || echo "[]")

HAS_404_ERROR=$(echo "$CUSTOM_ERRORS" | jq '[.[] | select(.ErrorCode == 404)] | length' 2>/dev/null || echo "0")

if [ "$HAS_404_ERROR" -gt 0 ]; then
  ERROR_RESPONSE=$(echo "$CUSTOM_ERRORS" | jq -r '.[] | select(.ErrorCode == 404) | "\(.ResponseCode) → \(.ResponsePagePath)"' 2>/dev/null || echo "")
  echo -e "${YELLOW}   ⚠️  404 errors return: ${ERROR_RESPONSE}${NC}"
  if echo "$ERROR_RESPONSE" | grep -q "index.html"; then
    echo -e "${YELLOW}   This causes missing JS files to return HTML!${NC}"
  fi
else
  echo -e "${GREEN}   ✅ No 404 custom error response (good for static files)${NC}"
fi

# Step 5: Summary and recommendations
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 DIAGNOSIS SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$MISSING_FILES" -gt 0 ]; then
  echo -e "${RED}❌ PROBLEM FOUND: HTML references JavaScript files that don't exist in S3${NC}"
  echo ""
  echo -e "${YELLOW}💡 SOLUTION: Rebuild and redeploy admin-web${NC}"
  echo ""
  echo -e "${BLUE}To fix this issue, run:${NC}"
  echo -e "   ${GREEN}cd ${PROJECT_ROOT}${NC}"
  echo -e "   ${GREEN}./prodscripts/deploy-admin-web-prod.sh${NC}"
  echo ""
  echo -e "${YELLOW}This will:${NC}"
  echo -e "   1. Rebuild the application with fresh JavaScript files"
  echo -e "   2. Upload all files to S3"
  echo -e "   3. Invalidate CloudFront cache"
  echo ""
else
  echo -e "${GREEN}✅ All referenced JavaScript files exist in S3${NC}"
  echo ""
  echo -e "${YELLOW}If you're still seeing errors, it might be a cache issue.${NC}"
  echo -e "${YELLOW}Try invalidating CloudFront cache:${NC}"
  echo ""
  echo -e "   ${GREEN}aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DIST_ID} --paths \"/*\"${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

#!/bin/bash
# Verify admin-web S3 bucket has all required JavaScript files
# This helps diagnose if the issue is missing files or CloudFront configuration

set -e

BUCKET="warmpawz-prod-admin-frontend-ap-south-1"
REGION="ap-south-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying Admin-Web S3 Bucket Files${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Step 1: Check if bucket exists and is accessible
echo -e "${BLUE}1. Checking S3 bucket access...${NC}"
if aws s3 ls "s3://${BUCKET}/" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅${NC} Bucket is accessible"
else
    echo -e "   ${RED}❌${NC} Cannot access bucket ${BUCKET}"
    echo -e "   ${YELLOW}   Check AWS credentials and bucket name${NC}"
    exit 1
fi

# Step 2: Check for index.html
echo ""
echo -e "${BLUE}2. Checking for index.html...${NC}"
if aws s3 ls "s3://${BUCKET}/index.html" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅${NC} index.html exists"
    HTML_SIZE=$(aws s3 ls "s3://${BUCKET}/index.html" | awk '{print $3}')
    echo -e "   ${BLUE}   Size: ${HTML_SIZE} bytes${NC}"
else
    echo -e "   ${RED}❌${NC} index.html NOT FOUND"
    echo -e "   ${YELLOW}   This is a critical file - deployment may be incomplete${NC}"
fi

# Step 3: Check for _next/static directory
echo ""
echo -e "${BLUE}3. Checking for _next/static directory...${NC}"
if aws s3 ls "s3://${BUCKET}/_next/static/" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅${NC} _next/static/ directory exists"
    
    # Count JavaScript files
    JS_COUNT=$(aws s3 ls "s3://${BUCKET}/_next/static/" --recursive 2>/dev/null | grep "\.js$" | wc -l || echo "0")
    echo -e "   ${BLUE}   Found ${JS_COUNT} JavaScript files${NC}"
    
    if [ "$JS_COUNT" -eq 0 ]; then
        echo -e "   ${RED}   ⚠️  WARNING: No JavaScript files found!${NC}"
        echo -e "   ${YELLOW}   This indicates a build or deployment issue${NC}"
    fi
else
    echo -e "   ${RED}❌${NC} _next/static/ directory NOT FOUND"
    echo -e "   ${YELLOW}   This is critical - JavaScript files should be here${NC}"
fi

# Step 4: Check for specific files from error messages
echo ""
echo -e "${BLUE}4. Checking for files mentioned in error messages...${NC}"
MISSING_COUNT=0
FOUND_COUNT=0

# Extract file patterns from error (these are chunk files with hashes)
ERROR_PATTERNS=(
    "_next/static/chunks/9895-*.js"
    "_next/static/chunks/webpack-*.js"
    "_next/static/chunks/error-*.js"
    "_next/static/chunks/not-found-*.js"
    "_next/static/chunks/layout-*.js"
    "_next/static/chunks/main-app-*.js"
    "_next/static/chunks/vendors-*.js"
    "_next/static/chunks/page-*.js"
)

for pattern in "${ERROR_PATTERNS[@]}"; do
    # Use wildcard matching in S3
    MATCHES=$(aws s3 ls "s3://${BUCKET}/${pattern}" 2>/dev/null | wc -l || echo "0")
    if [ "$MATCHES" -gt 0 ]; then
        FOUND_COUNT=$((FOUND_COUNT + 1))
        FILE_NAME=$(aws s3 ls "s3://${BUCKET}/${pattern}" 2>/dev/null | head -1 | awk '{print $4}' || echo "")
        if [ -n "$FILE_NAME" ]; then
            echo -e "   ${GREEN}✅${NC} Found: ${FILE_NAME}"
        fi
    else
        MISSING_COUNT=$((MISSING_COUNT + 1))
        BASE_NAME=$(basename "${pattern}" .js)
        echo -e "   ${YELLOW}⚠️${NC}  Pattern not found: ${pattern}"
    fi
done

# Step 5: Check for runtime-config.js
echo ""
echo -e "${BLUE}5. Checking for runtime-config.js...${NC}"
if aws s3 ls "s3://${BUCKET}/runtime-config.js" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅${NC} runtime-config.js exists"
else
    echo -e "   ${YELLOW}⚠️${NC}  runtime-config.js not found (may be optional)"
fi

# Step 6: Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$JS_COUNT" -gt 0 ] && [ "$MISSING_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ All files appear to be present in S3${NC}"
    echo -e "${BLUE}   The issue is likely CloudFront configuration${NC}"
    echo -e "${BLUE}   Run: ./prodscripts/fix-admin-cloudfront-static-files.sh${NC}"
elif [ "$JS_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No JavaScript files found in S3${NC}"
    echo -e "${YELLOW}   This indicates a deployment issue${NC}"
    echo -e "${YELLOW}   Solution: Rebuild and redeploy the application${NC}"
    echo -e "${YELLOW}   Run: ./prodscripts/deploy-admin-web-prod.sh${NC}"
else
    echo -e "${YELLOW}⚠️  Some files may be missing or have different hashes${NC}"
    echo -e "${BLUE}   This could be due to:${NC}"
    echo -e "${BLUE}   1. Build producing different file hashes${NC}"
    echo -e "${BLUE}   2. HTML referencing old file hashes${NC}"
    echo -e "${BLUE}   Solution: Rebuild and redeploy, then fix CloudFront${NC}"
fi

echo ""

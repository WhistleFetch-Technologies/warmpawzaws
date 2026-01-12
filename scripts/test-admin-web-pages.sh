#!/bin/bash

# Test Admin Web Pages Locally
# Tests all pages using curl to verify they load correctly

set -e

BASE_URL="http://localhost:3003"
TIMEOUT=5
FAILED_PAGES=()
PASSED_PAGES=()

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Admin Web Pages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/" | grep -q "200"; then
    echo -e "${RED}❌ Server is not running on $BASE_URL${NC}"
    echo "Please start the server with: cd apps/admin-web && npm start"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# List of pages to test (from build output)
PAGES=(
    "/"
    "/analytics"
    "/banners"
    "/catalog"
    "/ecommerce"
    "/enterprise"
    "/enterprise/logic-tab"
    "/finance"
    "/governance"
    "/integrations"
    "/logistics"
    "/loyalty"
    "/marketing"
    "/notifications"
    "/pet-info"
    "/platform-settings"
    "/promotions"
    "/refunds"
    "/regions"
    "/reports"
    "/roles"
    "/sellers"
    "/settlements"
    "/support"
    "/tiers"
    "/vendors"
)

echo "📋 Testing ${#PAGES[@]} pages..."
echo ""

# Test each page
for page in "${PAGES[@]}"; do
    url="${BASE_URL}${page}"
    echo -n "Testing ${page}... "
    
    # Get HTTP status code
    status_code=$(curl -s -o /tmp/page_response.html -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
    
    if [ "$status_code" = "200" ]; then
        # Check if response contains HTML
        if grep -q "<!DOCTYPE html\|<html" /tmp/page_response.html 2>/dev/null; then
            # Check if response has content
            content_size=$(wc -c < /tmp/page_response.html 2>/dev/null || echo "0")
            if [ "$content_size" -gt 100 ]; then
                echo -e "${GREEN}✅ PASS${NC} (Status: $status_code, Size: ${content_size} bytes)"
                PASSED_PAGES+=("$page")
            else
                echo -e "${YELLOW}⚠️  WARNING${NC} (Status: $status_code, Size: ${content_size} bytes - too small)"
                FAILED_PAGES+=("$page")
            fi
        else
            echo -e "${RED}❌ FAIL${NC} (Status: $status_code, No HTML content)"
            FAILED_PAGES+=("$page")
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $status_code)"
        FAILED_PAGES+=("$page")
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=${#PAGES[@]}
PASSED=${#PASSED_PAGES[@]}
FAILED=${#FAILED_PAGES[@]}

echo "Total Pages: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
fi
echo ""

# Show failed pages if any
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed Pages:${NC}"
    for page in "${FAILED_PAGES[@]}"; do
        echo "  - $page"
    done
    echo ""
fi

# Show sample of passed pages
if [ $PASSED -gt 0 ]; then
    echo -e "${GREEN}✅ Sample Passed Pages (first 5):${NC}"
    for i in "${!PASSED_PAGES[@]}"; do
        if [ $i -lt 5 ]; then
            echo "  - ${PASSED_PAGES[$i]}"
        fi
    done
    if [ $PASSED -gt 5 ]; then
        echo "  ... and $((PASSED - 5)) more"
    fi
    echo ""
fi

# Test specific endpoints
echo "🔍 Testing Additional Endpoints..."
echo ""

# Test 404 page
echo -n "Testing /_not-found... "
not_found_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "${BASE_URL}/_not-found" || echo "000")
if [ "$not_found_status" = "200" ] || [ "$not_found_status" = "404" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Status: $not_found_status)"
else
    echo -e "${YELLOW}⚠️  Status: $not_found_status${NC}"
fi

# Test non-existent page
echo -n "Testing /non-existent-page... "
non_existent_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "${BASE_URL}/non-existent-page" || echo "000")
if [ "$non_existent_status" = "404" ] || [ "$non_existent_status" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Status: $non_existent_status)"
else
    echo -e "${YELLOW}⚠️  Status: $non_existent_status${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Final result
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi

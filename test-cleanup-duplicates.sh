#!/bin/bash

# 🧹 Admin Cleanup - Duplicate Detection & Removal Test Script
# Tests the cleanup endpoints for finding and removing duplicates

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
PROJECT_ID="vpvpbdwtyugbknrntkho"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/marketing"

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Helper function to print test results
print_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        if [ -n "$message" ]; then
            echo -e "   $message"
        fi
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        if [ -n "$message" ]; then
            echo -e "   $message"
        fi
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "apikey: ${API_KEY}" \
            -H "Authorization: Bearer ${API_KEY}" \
            -H "Content-Type: application/json" \
            "${BASE_URL}${endpoint}"
    else
        curl -s -X "$method" \
            -H "apikey: ${API_KEY}" \
            -H "Authorization: Bearer ${API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${BASE_URL}${endpoint}"
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🧹 Admin Cleanup - Duplicate Detection & Removal Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}ℹ️  Note: Make sure the server is deployed with the latest cleanup endpoints${NC}"
echo -e "${YELLOW}   If you see 'Not Found' errors, deploy the server first using:${NC}"
echo -e "${YELLOW}   ./deploy-server.sh${NC}"
echo ""

# ==========================================
# STEP 1: Find Duplicates (Safe - Read Only)
# ==========================================
echo -e "${YELLOW}📋 STEP 1: Finding duplicates (safe - read only)${NC}"
echo ""

echo "Testing: POST /admin/cleanup/find-duplicates"
FIND_RESPONSE=$(api_call "POST" "/admin/cleanup/find-duplicates" "")

if echo "$FIND_RESPONSE" | grep -q '"success":true'; then
    PROMO_DUPS=$(echo "$FIND_RESPONSE" | grep -o '"duplicates":[0-9]*' | cut -d':' -f2)
    COUPON_DUPS=$(echo "$FIND_RESPONSE" | grep -o '"duplicates":[0-9]*' | tail -1 | cut -d':' -f2)
    
    if [ -z "$PROMO_DUPS" ]; then PROMO_DUPS=0; fi
    if [ -z "$COUPON_DUPS" ]; then COUPON_DUPS=0; fi
    
    print_test "Find Duplicates" "PASS" "Found $PROMO_DUPS promotion duplicate groups, $COUPON_DUPS coupon duplicate groups"
    
    # Pretty print the response
    echo "Response:"
    echo "$FIND_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$FIND_RESPONSE"
    echo ""
else
    print_test "Find Duplicates" "FAIL" "Failed to find duplicates"
    echo "Response: $FIND_RESPONSE"
fi

# ==========================================
# STEP 2: Test Removal in Dry-Run Mode (Safe)
# ==========================================
echo -e "${YELLOW}📋 STEP 2: Testing removal in dry-run mode (safe - no changes)${NC}"
echo ""

echo "Testing: POST /admin/cleanup/remove-duplicates (dryRun: true)"
DRY_RUN_DATA='{"dryRun": true}'
DRY_RUN_RESPONSE=$(api_call "POST" "/admin/cleanup/remove-duplicates" "$DRY_RUN_DATA")

if echo "$DRY_RUN_RESPONSE" | grep -q '"success":true'; then
    if echo "$DRY_RUN_RESPONSE" | grep -q '"dryRun":true'; then
        PROMO_REMOVE=$(echo "$DRY_RUN_RESPONSE" | grep -o '"totalPromotionsRemoved":[0-9]*' | cut -d':' -f2)
        COUPON_REMOVE=$(echo "$DRY_RUN_RESPONSE" | grep -o '"totalCouponsRemoved":[0-9]*' | cut -d':' -f2)
        
        if [ -z "$PROMO_REMOVE" ]; then PROMO_REMOVE=0; fi
        if [ -z "$COUPON_REMOVE" ]; then COUPON_REMOVE=0; fi
        
        print_test "Dry-Run Removal" "PASS" "Would remove $PROMO_REMOVE promotions, $COUPON_REMOVE coupons (no changes made)"
        
        # Pretty print the response
        echo "Response:"
        echo "$DRY_RUN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DRY_RUN_RESPONSE"
        echo ""
    else
        print_test "Dry-Run Removal" "FAIL" "Dry-run flag not set correctly"
    fi
else
    print_test "Dry-Run Removal" "FAIL" "Dry-run failed"
    echo "Response: $DRY_RUN_RESPONSE"
fi

# ==========================================
# STEP 3: Actually Remove Duplicates (Dangerous!)
# ==========================================
echo -e "${YELLOW}📋 STEP 3: Actually remove duplicates${NC}"
echo -e "${RED}⚠️  WARNING: This will permanently delete duplicate items!${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with actual deletion? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Skipping actual deletion. Use dry-run mode to preview changes.${NC}"
    echo ""
else
    echo "Testing: POST /admin/cleanup/remove-duplicates (dryRun: false)"
    REMOVE_DATA='{"dryRun": false}'
    REMOVE_RESPONSE=$(api_call "POST" "/admin/cleanup/remove-duplicates" "$REMOVE_DATA")
    
    if echo "$REMOVE_RESPONSE" | grep -q '"success":true'; then
        if echo "$REMOVE_RESPONSE" | grep -q '"dryRun":false'; then
            PROMO_REMOVED=$(echo "$REMOVE_RESPONSE" | grep -o '"totalPromotionsRemoved":[0-9]*' | cut -d':' -f2)
            COUPON_REMOVED=$(echo "$REMOVE_RESPONSE" | grep -o '"totalCouponsRemoved":[0-9]*' | cut -d':' -f2)
            
            if [ -z "$PROMO_REMOVED" ]; then PROMO_REMOVED=0; fi
            if [ -z "$COUPON_REMOVED" ]; then COUPON_REMOVED=0; fi
            
            print_test "Remove Duplicates" "PASS" "Removed $PROMO_REMOVED promotions, $COUPON_REMOVED coupons"
            
            # Pretty print the response
            echo "Response:"
            echo "$REMOVE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REMOVE_RESPONSE"
            echo ""
        else
            print_test "Remove Duplicates" "FAIL" "Dry-run flag not set correctly"
        fi
    else
        print_test "Remove Duplicates" "FAIL" "Removal failed"
        echo "Response: $REMOVE_RESPONSE"
    fi
fi

# ==========================================
# SUMMARY
# ==========================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Cleanup Endpoints Test Complete!${NC}"
    echo -e "   ✅ Find duplicates endpoint working"
    echo -e "   ✅ Dry-run mode working (safe preview)"
    echo -e "   ✅ Actual removal ready (use with caution)"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi


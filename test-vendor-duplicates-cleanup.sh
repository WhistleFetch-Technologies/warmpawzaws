#!/bin/bash

# 🧹 Vendor Duplicate Cleanup - Test Script
# Tests the cleanup endpoints for finding and removing duplicate vendor applications

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
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

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
echo -e "${BLUE}🧹 Vendor Duplicate Cleanup - Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}ℹ️  Note: This will find and remove duplicate vendor applications${NC}"
echo -e "${YELLOW}   Only applications with status 'pending' (awaiting approval) are checked${NC}"
echo ""

# ==========================================
# STEP 1: Find Duplicate Vendor Applications
# ==========================================
echo -e "${YELLOW}📋 STEP 1: Finding duplicate vendor applications (safe - read only)${NC}"
echo ""

echo "Testing: POST /admin/vendors/cleanup/find-duplicates"
FIND_RESPONSE=$(api_call "POST" "/admin/vendors/cleanup/find-duplicates" "")

if echo "$FIND_RESPONSE" | grep -q '"success":true'; then
    DUPLICATE_PHONES=$(echo "$FIND_RESPONSE" | grep -o '"duplicatePhones":[0-9]*' | cut -d':' -f2)
    DUPLICATE_APPS=$(echo "$FIND_RESPONSE" | grep -o '"duplicateApplications":[0-9]*' | cut -d':' -f2)
    
    if [ -z "$DUPLICATE_PHONES" ]; then DUPLICATE_PHONES=0; fi
    if [ -z "$DUPLICATE_APPS" ]; then DUPLICATE_APPS=0; fi
    
    print_test "Find Duplicate Vendor Applications" "PASS" "Found $DUPLICATE_PHONES duplicate phone numbers, $DUPLICATE_APPS duplicate applications"
    
    # Pretty print the response
    echo "Response:"
    echo "$FIND_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$FIND_RESPONSE"
    echo ""
else
    print_test "Find Duplicate Vendor Applications" "FAIL" "Failed to find duplicates"
    echo "Response: $FIND_RESPONSE"
fi

# ==========================================
# STEP 2: Test Removal in Dry-Run Mode (Safe)
# ==========================================
echo -e "${YELLOW}📋 STEP 2: Testing removal in dry-run mode (safe - no changes)${NC}"
echo ""

echo "Testing: POST /admin/vendors/cleanup/remove-duplicates (dryRun: true)"
DRY_RUN_DATA='{"dryRun": true}'
DRY_RUN_RESPONSE=$(api_call "POST" "/admin/vendors/cleanup/remove-duplicates" "$DRY_RUN_DATA")

if echo "$DRY_RUN_RESPONSE" | grep -q '"success":true'; then
    if echo "$DRY_RUN_RESPONSE" | grep -q '"dryRun":true'; then
        REMOVE_COUNT=$(echo "$DRY_RUN_RESPONSE" | grep -o '"removed":[0-9]*' | cut -d':' -f2)
        
        if [ -z "$REMOVE_COUNT" ]; then REMOVE_COUNT=0; fi
        
        print_test "Dry-Run Removal" "PASS" "Would remove $REMOVE_COUNT duplicate applications (no changes made)"
        
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
echo -e "${YELLOW}📋 STEP 3: Actually remove duplicate vendor applications${NC}"
echo -e "${RED}⚠️  WARNING: This will permanently delete duplicate applications!${NC}"
echo -e "${RED}   Only applications with status 'pending' (awaiting approval) will be removed${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with actual deletion? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Skipping actual deletion. Use dry-run mode to preview changes.${NC}"
    echo ""
else
    echo "Testing: POST /admin/vendors/cleanup/remove-duplicates (dryRun: false)"
    REMOVE_DATA='{"dryRun": false}'
    REMOVE_RESPONSE=$(api_call "POST" "/admin/vendors/cleanup/remove-duplicates" "$REMOVE_DATA")
    
    if echo "$REMOVE_RESPONSE" | grep -q '"success":true'; then
        if echo "$REMOVE_RESPONSE" | grep -q '"dryRun":false'; then
            REMOVED_COUNT=$(echo "$REMOVE_RESPONSE" | grep -o '"removed":[0-9]*' | cut -d':' -f2)
            
            if [ -z "$REMOVED_COUNT" ]; then REMOVED_COUNT=0; fi
            
            print_test "Remove Duplicate Vendor Applications" "PASS" "Removed $REMOVED_COUNT duplicate applications"
            
            # Pretty print the response
            echo "Response:"
            echo "$REMOVE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REMOVE_RESPONSE"
            echo ""
        else
            print_test "Remove Duplicate Vendor Applications" "FAIL" "Dry-run flag not set correctly"
        fi
    else
        print_test "Remove Duplicate Vendor Applications" "FAIL" "Removal failed"
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
    echo -e "${GREEN}🎉 Vendor Duplicate Cleanup Test Complete!${NC}"
    echo -e "   ✅ Find duplicates endpoint working"
    echo -e "   ✅ Dry-run mode working (safe preview)"
    echo -e "   ✅ Actual removal ready (use with caution)"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi



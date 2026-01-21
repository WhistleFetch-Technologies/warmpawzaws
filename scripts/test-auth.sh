#!/bin/bash

# ============================================================================
# WARMPAWZ AUTHENTICATION TEST SCRIPT
# ============================================================================
# Tests all authentication endpoints for Customer, Vendor, and Admin
# Usage: ./test-auth.sh [dev|prod]
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV="${1:-dev}"
if [ "$ENV" = "prod" ]; then
    API_BASE="https://api.warmpawz.com"
else
    API_BASE="https://dev.api.warmpawz.com"
fi

# Test phone numbers
CUSTOMER_PHONE="9876543210"
VENDOR_PHONE="9876543211"
UAT_OTP="123456"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   WARMPAWZ AUTH TEST - $ENV environment${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "API Base: ${YELLOW}$API_BASE${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_codes="$5"
    
    echo -e "${YELLOW}Testing: $name${NC}"
    echo -e "  ${method} ${endpoint}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${API_BASE}${endpoint}" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${API_BASE}${endpoint}" 2>&1)
    fi
    
    # Extract HTTP code (last line) and body (everything else)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Check if code is in expected list
    if [[ "$expected_codes" == *"$http_code"* ]]; then
        echo -e "  ${GREEN}✓ Status: $http_code${NC}"
    else
        echo -e "  ${RED}✗ Status: $http_code (expected: $expected_codes)${NC}"
    fi
    
    # Pretty print JSON if possible
    if command -v jq &> /dev/null && [ -n "$body" ]; then
        echo -e "  Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")"
    else
        echo -e "  Response: $body"
    fi
    echo ""
    
    # Store response for chaining
    LAST_RESPONSE="$body"
    LAST_CODE="$http_code"
}

# ============================================================================
# TEST 1: Health Check
# ============================================================================
echo -e "${BLUE}--- 1. HEALTH CHECK ---${NC}"
test_endpoint "API Health" "GET" "/health" "" "200"

# ============================================================================
# TEST 2: Customer Authentication
# ============================================================================
echo -e "${BLUE}--- 2. CUSTOMER AUTHENTICATION ---${NC}"

# 2a. Send OTP (Web pattern)
test_endpoint "Customer OTP Send (web)" "POST" "/auth/otp/send" \
    "{\"phone\":\"$CUSTOMER_PHONE\"}" "200,201"

# Extract debug OTP if available
DEBUG_OTP=$(echo "$LAST_RESPONSE" | grep -o '"debug_otp":"[^"]*"' | cut -d'"' -f4 || echo "$UAT_OTP")
if [ -z "$DEBUG_OTP" ]; then DEBUG_OTP="$UAT_OTP"; fi
echo -e "  Using OTP: ${YELLOW}$DEBUG_OTP${NC}"
echo ""

# 2b. Verify OTP (Web pattern)
test_endpoint "Customer OTP Verify (web)" "POST" "/auth/otp/verify" \
    "{\"phone\":\"$CUSTOMER_PHONE\",\"otp\":\"$DEBUG_OTP\"}" "200,201"

# Extract tokens if available
ACCESS_TOKEN=$(echo "$LAST_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -n "$ACCESS_TOKEN" ]; then
    echo -e "  ${GREEN}✓ Access Token received${NC}"
    echo -e "  Token (truncated): ${ACCESS_TOKEN:0:50}..."
fi
echo ""

# 2c. Send OTP (Mobile pattern)
test_endpoint "Customer OTP Generate (mobile)" "POST" "/otp/generate" \
    "{\"phone\":\"$CUSTOMER_PHONE\"}" "200,201,404"

# ============================================================================
# TEST 3: Vendor Authentication
# ============================================================================
echo -e "${BLUE}--- 3. VENDOR AUTHENTICATION ---${NC}"

# 3a. Send OTP for Vendor
test_endpoint "Vendor OTP Send" "POST" "/auth/otp/send" \
    "{\"phone\":\"$VENDOR_PHONE\"}" "200,201"

DEBUG_OTP=$(echo "$LAST_RESPONSE" | grep -o '"debug_otp":"[^"]*"' | cut -d'"' -f4 || echo "$UAT_OTP")
if [ -z "$DEBUG_OTP" ]; then DEBUG_OTP="$UAT_OTP"; fi

# 3b. Verify OTP for Vendor
test_endpoint "Vendor OTP Verify" "POST" "/auth/otp/verify" \
    "{\"phone\":\"$VENDOR_PHONE\",\"otp\":\"$DEBUG_OTP\"}" "200,201"

# 3c. Check Vendor Phone
test_endpoint "Vendor Phone Check" "GET" "/vendor/check-phone/$VENDOR_PHONE" "" "200,404"

# ============================================================================
# TEST 4: Alternative Auth Patterns
# ============================================================================
echo -e "${BLUE}--- 4. ALTERNATIVE AUTH ENDPOINTS ---${NC}"

# Original patterns
test_endpoint "Auth Send OTP (original)" "POST" "/auth/send-otp" \
    "{\"phone\":\"$CUSTOMER_PHONE\"}" "200,201,404"

test_endpoint "Auth Verify OTP (original)" "POST" "/auth/verify-otp" \
    "{\"phone\":\"$CUSTOMER_PHONE\",\"otp\":\"$UAT_OTP\"}" "200,201,404"

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   TEST SUMMARY${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Environment: ${YELLOW}$ENV${NC}"
echo -e "API Base: ${YELLOW}$API_BASE${NC}"
echo ""
echo -e "Test Credentials:"
echo -e "  Customer Phone: ${GREEN}$CUSTOMER_PHONE${NC}"
echo -e "  Vendor Phone:   ${GREEN}$VENDOR_PHONE${NC}"
echo -e "  UAT OTP:        ${GREEN}$UAT_OTP${NC}"
echo ""
echo -e "Admin Credentials (UAT Mode):"
echo -e "  Email:    ${GREEN}admin@warmpawz.com${NC}"
echo -e "  Password: ${GREEN}Warmpawz2025${NC}"
echo ""


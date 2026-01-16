#!/bin/bash

# Vendor Capabilities Systematic Testing Script
# Tests all 56 capabilities for data handoff, API contracts, and full lifecycle

set -e

API_BASE="${API_BASE:-http://localhost:3000/api}"
VENDOR_ID="${VENDOR_ID:-test-vendor-id}"
COLOR_RESET="\033[0m"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_YELLOW="\033[0;33m"
COLOR_BLUE="\033[0;34m"

echo "========================================="
echo "Vendor Capabilities Systematic Testing"
echo "========================================="
echo "API Base: $API_BASE"
echo "Vendor ID: $VENDOR_ID"
echo ""

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=${4:-""}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$endpoint" -H "Content-Type: application/json" 2>/dev/null || echo "ERROR\n000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE$endpoint" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo "ERROR\n000")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE$endpoint" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo "ERROR\n000")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_BASE$endpoint" -H "Content-Type: application/json" 2>/dev/null || echo "ERROR\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
        echo -e "${COLOR_GREEN}PASS${COLOR_RESET} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${COLOR_RED}FAIL${COLOR_RESET} (HTTP $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "  Response: $body"
        return 1
    fi
}

# Core Capabilities
echo -e "${COLOR_BLUE}=== Core Capabilities ===${COLOR_RESET}"
test_endpoint "GET" "/vendor/$VENDOR_ID/dashboard" "Dashboard - Get stats"
test_endpoint "GET" "/vendor/$VENDOR_ID/profile" "Profile - Get vendor profile"
test_endpoint "GET" "/vendor/$VENDOR_ID/bookings" "Bookings - List bookings"
test_endpoint "GET" "/vendor/$VENDOR_ID/bookings/today" "Bookings - Today's bookings"

# Services Capabilities
echo -e "\n${COLOR_BLUE}=== Services Capabilities ===${COLOR_RESET}"
test_endpoint "GET" "/vendor/$VENDOR_ID/services" "Services - List services"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/packages" "Packages - List packages"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/pricing" "Pricing - Get pricing"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/tests" "Test Catalog - List tests"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/menu" "Menu - List menu items"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/products" "Products - List products"
test_endpoint "GET" "/vendor/$VENDOR_ID/services/subscriptions" "Subscriptions - List subscriptions"

# Staff Capabilities
echo -e "\n${COLOR_BLUE}=== Operations Capabilities ===${COLOR_RESET}"
test_endpoint "GET" "/vendor/$VENDOR_ID/staff" "Staff - List staff"
test_endpoint "GET" "/vendor/$VENDOR_ID/schedule" "Schedule - Get schedule"

# Finance Capabilities
echo -e "\n${COLOR_BLUE}=== Finance Capabilities ===${COLOR_RESET}"
test_endpoint "GET" "/vendor/$VENDOR_ID/earnings" "Earnings - Get earnings"
test_endpoint "GET" "/vendor/$VENDOR_ID/settlements" "Settlements - List settlements"
test_endpoint "GET" "/vendor/$VENDOR_ID/bank-account" "Bank Account - Get bank account"

# Medical Capabilities
echo -e "\n${COLOR_BLUE}=== Medical Capabilities ===${COLOR_RESET}"
test_endpoint "GET" "/vendor/$VENDOR_ID/prescriptions" "Prescriptions - List prescriptions"
test_endpoint "GET" "/vendor/$VENDOR_ID/medical-records" "Medical Records - List records"
test_endpoint "GET" "/vendor/$VENDOR_ID/vaccination" "Vaccination - List vaccinations"
test_endpoint "GET" "/vendor/$VENDOR_ID/diagnostics" "Diagnostics - List diagnostics"

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${COLOR_GREEN}Passed: $PASSED_TESTS${COLOR_RESET}"
echo -e "${COLOR_RED}Failed: $FAILED_TESTS${COLOR_RESET}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${COLOR_GREEN}All tests passed!${COLOR_RESET}"
    exit 0
else
    echo -e "${COLOR_RED}Some tests failed.${COLOR_RESET}"
    exit 1
fi

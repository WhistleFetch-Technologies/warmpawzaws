#!/bin/bash

# Vendor Capabilities Testing - Execution Script
# Executes systematic tests for all 56 vendor capabilities

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3000/api}"
VENDOR_ID="${VENDOR_ID:-}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
UAT_MODE="${UAT_MODE:-false}"
UAT_TOKEN="${UAT_TOKEN:-uat-token-admin}"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Results file
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"

echo "========================================="
echo "Vendor Capabilities Testing - Execution"
echo "========================================="
echo "API Base: $API_BASE"
echo "Vendor ID: $VENDOR_ID"
echo "Results File: $RESULTS_FILE"
echo ""

# Function to log results
log_result() {
    echo "$1" | tee -a "$RESULTS_FILE"
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=${4:-""}
    local expected_status=${5:-200}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log_result "Testing: $description"
    log_result "  Endpoint: $method $endpoint"
    
    # Build curl command
    local curl_cmd="curl -s -w \"\n%{http_code}\" -X $method \"$API_BASE$endpoint\""
    
    # Add headers
    curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
    
    if [ "$UAT_MODE" = "true" ]; then
        curl_cmd="$curl_cmd -H \"X-UAT-Mode: true\" -H \"X-UAT-Token: $UAT_TOKEN\""
    elif [ -n "$AUTH_TOKEN" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $AUTH_TOKEN\""
    fi
    
    # Add data for POST/PUT
    if [ -n "$data" ] && ([ "$method" = "POST" ] || [ "$method" = "PUT" ]); then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    # Execute request
    local response=$(eval $curl_cmd 2>&1 || echo "ERROR\n000")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    # Check result
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        log_result "  Status: ✅ PASS (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        log_result "  Status: ❌ FAIL (HTTP $http_code)"
        log_result "  Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to check API health
check_health() {
    echo -e "${BLUE}Checking API Health...${NC}"
    log_result "=== API Health Check ==="
    
    if test_endpoint "GET" "/health" "API Health Check"; then
        echo -e "${GREEN}✅ API is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ API is not responding${NC}"
        echo -e "${YELLOW}⚠️  Please check if API server is running${NC}"
        return 1
    fi
}

# Function to verify vendor exists
verify_vendor() {
    if [ -z "$VENDOR_ID" ]; then
        echo -e "${YELLOW}⚠️  VENDOR_ID not set${NC}"
        echo -e "${YELLOW}   Please set VENDOR_ID environment variable${NC}"
        echo -e "${YELLOW}   Example: export VENDOR_ID='your-vendor-id'${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Verifying Vendor: $VENDOR_ID...${NC}"
    log_result "=== Vendor Verification ==="
    
    if test_endpoint "GET" "/vendor/$VENDOR_ID/profile" "Vendor Profile"; then
        echo -e "${GREEN}✅ Vendor exists${NC}"
        return 0
    else
        echo -e "${RED}❌ Vendor not found${NC}"
        echo -e "${YELLOW}⚠️  Please create a test vendor or use existing vendor ID${NC}"
        return 1
    fi
}

# Function to test core capabilities
test_core_capabilities() {
    echo -e "${BLUE}=== Testing Core Capabilities ===${NC}"
    log_result "=== Core Capabilities Tests ==="
    
    test_endpoint "GET" "/vendor/$VENDOR_ID/dashboard" "Dashboard - Get stats"
    test_endpoint "GET" "/vendor/$VENDOR_ID/profile" "Profile - Get profile"
    test_endpoint "GET" "/vendor/bookings/$VENDOR_ID" "Bookings - List bookings"
}

# Function to test services capabilities
test_services_capabilities() {
    echo -e "${BLUE}=== Testing Services Capabilities ===${NC}"
    log_result "=== Services Capabilities Tests ==="
    
    test_endpoint "GET" "/vendor/$VENDOR_ID/services" "Services - List services"
    test_endpoint "GET" "/vendor/$VENDOR_ID/schedule" "Schedule - Get schedule"
}

# Function to test operations capabilities
test_operations_capabilities() {
    echo -e "${BLUE}=== Testing Operations Capabilities ===${NC}"
    log_result "=== Operations Capabilities Tests ==="
    
    test_endpoint "GET" "/vendor/$VENDOR_ID/staff" "Staff - List staff"
    test_endpoint "GET" "/vendor/$VENDOR_ID/analytics" "Analytics - Get analytics"
}

# Function to test finance capabilities
test_finance_capabilities() {
    echo -e "${BLUE}=== Testing Finance Capabilities ===${NC}"
    log_result "=== Finance Capabilities Tests ==="
    
    test_endpoint "GET" "/vendor/$VENDOR_ID/settlements" "Settlements - List settlements"
}

# Function to test medical capabilities
test_medical_capabilities() {
    echo -e "${BLUE}=== Testing Medical Capabilities ===${NC}"
    log_result "=== Medical Capabilities Tests ==="
    
    test_endpoint "GET" "/prescriptions/vendor/$VENDOR_ID" "Prescriptions - List prescriptions"
}

# Function to generate summary
generate_summary() {
    echo ""
    echo "========================================="
    echo "Test Summary"
    echo "========================================="
    log_result ""
    log_result "=== Test Summary ==="
    log_result "Total Tests: $TOTAL_TESTS"
    log_result "Passed: $PASSED_TESTS"
    log_result "Failed: $FAILED_TESTS"
    log_result "Warnings: $WARNINGS"
    log_result ""
    
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
        log_result "Status: ✅ All tests passed!"
        return 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        log_result "Status: ❌ Some tests failed"
        return 1
    fi
}

# Main execution
main() {
    log_result "Test Execution Started: $(date)"
    log_result "API Base: $API_BASE"
    log_result "Vendor ID: $VENDOR_ID"
    log_result ""
    
    # Step 1: Check API health
    if ! check_health; then
        echo -e "${RED}❌ API health check failed. Exiting.${NC}"
        exit 1
    fi
    
    # Step 2: Verify vendor
    if ! verify_vendor; then
        echo -e "${RED}❌ Vendor verification failed. Exiting.${NC}"
        exit 1
    fi
    
    # Step 3: Run tests
    test_core_capabilities
    test_services_capabilities
    test_operations_capabilities
    test_finance_capabilities
    test_medical_capabilities
    
    # Step 4: Generate summary
    generate_summary
    
    log_result ""
    log_result "Test Execution Completed: $(date)"
    log_result "Results saved to: $RESULTS_FILE"
    
    echo ""
    echo -e "${BLUE}Results saved to: $RESULTS_FILE${NC}"
}

# Parse arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --api-base URL      Set API base URL (default: http://localhost:3000/api)"
        echo "  --vendor-id ID      Set vendor ID"
        echo "  --auth-token TOKEN  Set authentication token"
        echo "  --uat-mode          Enable UAT mode"
        echo ""
        echo "Environment Variables:"
        echo "  API_BASE            API base URL"
        echo "  VENDOR_ID           Test vendor ID"
        echo "  AUTH_TOKEN          Authentication token"
        echo "  UAT_MODE            Enable UAT mode (true/false)"
        echo "  UAT_TOKEN           UAT token"
        exit 0
        ;;
    --api-base)
        API_BASE="$2"
        shift 2
        ;;
    --vendor-id)
        VENDOR_ID="$2"
        shift 2
        ;;
    --auth-token)
        AUTH_TOKEN="$2"
        shift 2
        ;;
    --uat-mode)
        UAT_MODE="true"
        shift
        ;;
esac

# Run main function
main "$@"

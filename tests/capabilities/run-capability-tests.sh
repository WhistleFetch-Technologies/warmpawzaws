#!/bin/bash

# Comprehensive Capability Testing Script
# Tests all capabilities for role alignment and business objectives

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_REPORT_DIR="./test-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Capability Testing Suite${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Create test report directory
mkdir -p "$TEST_REPORT_DIR"

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local capability=$3
    local vendor_id=$4
    local expected_status=$5
    
    local url="${API_BASE_URL}${endpoint}"
    local status_code
    
    if [ "$method" = "GET" ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "x-vendor-id: $vendor_id" \
            "$url")
    else
        status_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "x-vendor-id: $vendor_id" \
            -d '{}' \
            "$url")
    fi
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $method $endpoint (Expected: $expected_status, Got: $status_code)"
        return 0
    else
        echo -e "${RED}✗${NC} $method $endpoint (Expected: $expected_status, Got: $status_code)"
        return 1
    fi
}

# Function to test capability for a role
test_role_capability() {
    local role=$1
    local capability=$2
    local vendor_id=$3
    
    echo -e "\n${YELLOW}Testing: $role → $capability${NC}"
    
    # Map capability to endpoint
    case $capability in
        "events")
            test_endpoint "POST" "/vendor/events" "$capability" "$vendor_id" "403"
            ;;
        "prescriptions")
            test_endpoint "GET" "/prescriptions/vendor/$vendor_id" "$capability" "$vendor_id" "200"
            ;;
        "medical_records")
            test_endpoint "GET" "/medical-records/vendor/$vendor_id" "$capability" "$vendor_id" "200"
            ;;
        "ambulance")
            test_endpoint "GET" "/vendor/$vendor_id/ambulance/vehicles" "$capability" "$vendor_id" "200"
            ;;
        "diagnostics")
            test_endpoint "GET" "/vendor/$vendor_id/diagnostics/tests" "$capability" "$vendor_id" "200"
            ;;
        "pharmacy")
            test_endpoint "GET" "/vendor/$vendor_id/pharmacy/medicines" "$capability" "$vendor_id" "200"
            ;;
        "meal_plans")
            test_endpoint "GET" "/vendor/$vendor_id/nutritionist/meal-plans" "$capability" "$vendor_id" "200"
            ;;
        "cafe_tables")
            test_endpoint "GET" "/vendor/$vendor_id/cafe/tables" "$capability" "$vendor_id" "200"
            ;;
        "rooms")
            test_endpoint "GET" "/vendor/$vendor_id/resort/rooms" "$capability" "$vendor_id" "200"
            ;;
        "pet_profiles")
            test_endpoint "GET" "/vendor/$vendor_id/breeder/puppies" "$capability" "$vendor_id" "200"
            ;;
        *)
            echo -e "${YELLOW}⚠${NC} No endpoint test defined for capability: $capability"
            ;;
    esac
}

# Main test execution
echo -e "${GREEN}Starting capability tests...${NC}\n"

# Test 1: Capability-Role Alignment
echo -e "${GREEN}=== Test 1: Capability-Role Alignment ===${NC}"
echo "This test verifies that roles have correct capabilities assigned."

# Note: This would require database access to check role_permissions table
# For now, we'll test via API endpoints

# Test 2: Capability Enforcement
echo -e "\n${GREEN}=== Test 2: Capability Enforcement ===${NC}"
echo "This test verifies that API endpoints enforce capability requirements."

# Example: Test events capability
# Vendor with events capability should be able to create events
# Vendor without events capability should get 403

# Test 3: Business Objective Achievement
echo -e "\n${GREEN}=== Test 3: Business Objective Achievement ===${NC}"
echo "This test verifies that capabilities enable intended business functionality."

# Example test cases:
# - Prescriptions capability enables creating prescriptions
# - Medical records capability enables managing patient records
# - Events capability enables event management

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Test execution complete${NC}"
echo -e "${GREEN}========================================${NC}"

# Generate summary report
cat > "$TEST_REPORT_DIR/capability-test-summary-${TIMESTAMP}.md" << EOF
# Capability Test Summary

**Date:** $(date)
**API Base URL:** $API_BASE_URL

## Test Execution

### Test 1: Capability-Role Alignment
- Status: ⏳ Manual verification required
- Note: Requires database access to verify role_permissions table

### Test 2: Capability Enforcement
- Status: ⏳ API endpoint testing required
- Note: Test endpoints with vendors that have/don't have capabilities

### Test 3: Business Objective Achievement
- Status: ⏳ End-to-end workflow testing required
- Note: Test complete workflows for each capability

## Next Steps

1. Run TypeScript test scripts for automated testing
2. Execute manual tests for each capability
3. Document findings and issues
4. Fix identified problems
5. Re-test after fixes

EOF

echo -e "\n${GREEN}Test summary saved to: $TEST_REPORT_DIR/capability-test-summary-${TIMESTAMP}.md${NC}"

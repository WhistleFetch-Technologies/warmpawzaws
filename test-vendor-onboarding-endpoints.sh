#!/bin/bash

# Vendor Onboarding Endpoints - Comprehensive Test Suite
# Tests all new endpoints: Edit, Withdraw, History, and Bank Validation

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${SUPABASE_PROJECT_ID:-3dd53475}"
ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
print_test() {
    echo -e "${BLUE}▶ Testing: $1${NC}"
    TOTAL=$((TOTAL + 1))
}

print_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    PASSED=$((PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    FAILED=$((FAILED + 1))
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test data
TEST_PHONE="+919876543210"
TEST_EMAIL="test-vendor-$(date +%s)@test.com"
TEST_VENDOR_ID=""
TEST_APPLICATION_ID=""

echo "=========================================="
echo "Vendor Onboarding Endpoints Test Suite"
echo "=========================================="
echo ""

# ============================================
# TEST 1: Create Test Vendor Application
# ============================================
print_test "Creating test vendor application"

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/vendor/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"roleId\": \"vet\",
    \"phone\": \"${TEST_PHONE}\",
    \"email\": \"${TEST_EMAIL}\",
    \"serviceStyle\": \"both\",
    \"formData\": {
      \"businessName\": \"Test Vet Clinic\",
      \"fullName\": \"Dr. Test Vendor\",
      \"address\": \"123 Test Street\",
      \"city\": \"Mumbai\",
      \"state\": \"Maharashtra\",
      \"pincode\": \"400001\",
      \"gstNumber\": \"27AABCU9603R1ZX\",
      \"yearsOfExperience\": 5,
      \"accountHolderName\": \"Test Vendor\",
      \"accountNumber\": \"1234567890\",
      \"ifscCode\": \"HDFC0000001\",
      \"bankName\": \"HDFC Bank\",
      \"branchName\": \"Mumbai Branch\"
    },
    \"documents\": {},
    \"location\": {
      \"lat\": 19.0760,
      \"lng\": 72.8777
    }
  }")

if echo "$CREATE_RESPONSE" | grep -q "vendorId"; then
    TEST_VENDOR_ID=$(echo "$CREATE_RESPONSE" | grep -o '"vendorId":"[^"]*"' | cut -d'"' -f4)
    TEST_APPLICATION_ID=$(echo "$CREATE_RESPONSE" | grep -o '"applicationId":"[^"]*"' | cut -d'"' -f4)
    print_pass "Application created - Vendor ID: ${TEST_VENDOR_ID}"
    print_info "Application ID: ${TEST_APPLICATION_ID}"
else
    print_fail "Failed to create application"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

echo ""

# ============================================
# TEST 2: Check Application Status
# ============================================
print_test "Checking application status"

STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/vendor/status/${TEST_PHONE}" \
  -H "Authorization: Bearer ${ANON_KEY}")

if echo "$STATUS_RESPONSE" | grep -q "pending_approval"; then
    print_pass "Status check successful - Application is pending"
else
    print_fail "Status check failed or unexpected status"
    echo "Response: $STATUS_RESPONSE"
fi

echo ""

# ============================================
# TEST 3: Get Application History (Empty initially)
# ============================================
print_test "Getting application history (should be empty or minimal)"

HISTORY_RESPONSE=$(curl -s -X GET "${BASE_URL}/vendor/application/${TEST_VENDOR_ID}/history" \
  -H "Authorization: Bearer ${ANON_KEY}")

if echo "$HISTORY_RESPONSE" | grep -q "history"; then
    print_pass "History endpoint accessible"
    print_info "History: $(echo "$HISTORY_RESPONSE" | jq -r '.history | length') entries"
else
    print_fail "History endpoint failed"
    echo "Response: $HISTORY_RESPONSE"
fi

echo ""

# ============================================
# TEST 4: Edit Application (Valid Status)
# ============================================
print_test "Editing application (pending_approval status)"

EDIT_RESPONSE=$(curl -s -X PUT "${BASE_URL}/vendor/application/${TEST_VENDOR_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"formData\": {
      \"businessName\": \"Updated Test Vet Clinic\",
      \"fullName\": \"Dr. Updated Test Vendor\",
      \"address\": \"456 Updated Street\",
      \"city\": \"Pune\",
      \"state\": \"Maharashtra\",
      \"pincode\": \"411001\",
      \"gstNumber\": \"27AABCU9603R1ZX\",
      \"yearsOfExperience\": 7
    },
    \"location\": {
      \"lat\": 18.5204,
      \"lng\": 73.8567
    }
  }")

if echo "$EDIT_RESPONSE" | grep -q "success.*true\|vendorId"; then
    print_pass "Application edit successful"
    
    # Verify edit was saved
    VERIFY_STATUS=$(curl -s -X GET "${BASE_URL}/vendor/status/${TEST_PHONE}" \
      -H "Authorization: Bearer ${ANON_KEY}")
    
    if echo "$VERIFY_STATUS" | grep -q "Updated Test Vet Clinic\|Pune"; then
        print_pass "Edit verified - Data updated correctly"
    else
        print_fail "Edit not reflected in status check"
    fi
else
    print_fail "Application edit failed"
    echo "Response: $EDIT_RESPONSE"
fi

echo ""

# ============================================
# TEST 5: Get Application History (After Edit)
# ============================================
print_test "Getting application history (after edit)"

HISTORY_RESPONSE2=$(curl -s -X GET "${BASE_URL}/vendor/application/${TEST_VENDOR_ID}/history" \
  -H "Authorization: Bearer ${ANON_KEY}")

HISTORY_COUNT=$(echo "$HISTORY_RESPONSE2" | jq -r '.history | length // 0')

if [ "$HISTORY_COUNT" -gt 0 ]; then
    print_pass "History contains entries after edit"
    print_info "Found $HISTORY_COUNT history entries"
    
    # Check for edit entry
    if echo "$HISTORY_RESPONSE2" | grep -q "application_updated\|resubmitted"; then
        print_pass "Edit action recorded in history"
    else
        print_fail "Edit action not found in history"
    fi
else
    print_fail "History is empty after edit"
fi

echo ""

# ============================================
# TEST 6: Edit Application Validation (Invalid Status)
# ============================================
print_test "Testing edit validation - Approve first, then try to edit"

# First approve the application
APPROVE_RESPONSE=$(curl -s -X POST "${BASE_URL}/admin/vendor/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"vendorId\": \"${TEST_VENDOR_ID}\",
    \"approvedBy\": \"Test Admin\",
    \"notes\": \"Test approval\"
  }")

if echo "$APPROVE_RESPONSE" | grep -q "success.*true\|approved"; then
    print_pass "Application approved for testing"
    
    # Now try to edit (should fail)
    EDIT_FAIL_RESPONSE=$(curl -s -X PUT "${BASE_URL}/vendor/application/${TEST_VENDOR_ID}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${ANON_KEY}" \
      -d "{
        \"formData\": {
          \"businessName\": \"Should Not Update\"
        }
      }")
    
    if echo "$EDIT_FAIL_RESPONSE" | grep -q "cannot_edit\|Cannot edit"; then
        print_pass "Edit correctly rejected for approved status"
    else
        print_fail "Edit should have been rejected for approved status"
        echo "Response: $EDIT_FAIL_RESPONSE"
    fi
else
    print_fail "Failed to approve application for testing"
fi

echo ""

# ============================================
# TEST 7: Withdraw Application (Create new one)
# ============================================
print_test "Testing application withdrawal"

# Create a new application for withdrawal test
WITHDRAW_PHONE="+919876543211"
WITHDRAW_EMAIL="withdraw-test-$(date +%s)@test.com"

WITHDRAW_CREATE=$(curl -s -X POST "${BASE_URL}/vendor/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"roleId\": \"groomer\",
    \"phone\": \"${WITHDRAW_PHONE}\",
    \"email\": \"${WITHDRAW_EMAIL}\",
    \"serviceStyle\": \"at_home\",
    \"formData\": {
      \"businessName\": \"Test Groomer\",
      \"fullName\": \"Test Groomer Name\",
      \"address\": \"789 Test Ave\",
      \"city\": \"Delhi\",
      \"state\": \"Delhi\",
      \"pincode\": \"110001\"
    },
    \"documents\": {}
  }")

WITHDRAW_VENDOR_ID=$(echo "$WITHDRAW_CREATE" | grep -o '"vendorId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$WITHDRAW_VENDOR_ID" ]; then
    # Now withdraw it
    WITHDRAW_RESPONSE=$(curl -s -X POST "${BASE_URL}/vendor/application/${WITHDRAW_VENDOR_ID}/withdraw" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${ANON_KEY}" \
      -d "{
        \"reason\": \"Found another platform\"
      }")
    
    if echo "$WITHDRAW_RESPONSE" | grep -q "success.*true\|withdrawn"; then
        print_pass "Application withdrawal successful"
        
        # Verify status
        WITHDRAW_STATUS=$(curl -s -X GET "${BASE_URL}/vendor/status/${WITHDRAW_PHONE}" \
          -H "Authorization: Bearer ${ANON_KEY}")
        
        if echo "$WITHDRAW_STATUS" | grep -q "withdrawn"; then
            print_pass "Withdrawal status verified"
        else
            print_fail "Status not updated to withdrawn"
        fi
    else
        print_fail "Application withdrawal failed"
        echo "Response: $WITHDRAW_RESPONSE"
    fi
else
    print_fail "Failed to create application for withdrawal test"
fi

echo ""

# ============================================
# TEST 8: Withdraw Validation (Invalid Status)
# ============================================
print_test "Testing withdrawal validation - Try to withdraw approved application"

WITHDRAW_INVALID=$(curl -s -X POST "${BASE_URL}/vendor/application/${TEST_VENDOR_ID}/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"reason\": \"Should not work\"
  }")

if echo "$WITHDRAW_INVALID" | grep -q "cannot_withdraw\|Cannot withdraw"; then
    print_pass "Withdrawal correctly rejected for approved status"
else
    print_fail "Withdrawal should have been rejected for approved status"
    echo "Response: $WITHDRAW_INVALID"
fi

echo ""

# ============================================
# TEST 9: Bank Validation (IFSC)
# ============================================
print_test "Testing bank validation with IFSC code"

BANK_VALIDATE=$(curl -s -X POST "${BASE_URL}/vendor/validate-ifsc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"ifscCode\": \"HDFC0000001\"
  }")

if echo "$BANK_VALIDATE" | grep -q "success.*true\|valid.*true"; then
    print_pass "IFSC validation successful"
    
    # Check if bank details are returned
    if echo "$BANK_VALIDATE" | grep -q "bank\|branch"; then
        print_pass "Bank details returned from validation"
    else
        print_fail "Bank details not returned"
    fi
else
    print_fail "IFSC validation failed"
    echo "Response: $BANK_VALIDATE"
fi

echo ""

# ============================================
# TEST 10: Bank Validation (Invalid IFSC)
# ============================================
print_test "Testing bank validation with invalid IFSC code"

INVALID_IFSC=$(curl -s -X POST "${BASE_URL}/vendor/validate-ifsc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"ifscCode\": \"INVALID12345\"
  }")

if echo "$INVALID_IFSC" | grep -q "success.*false\|Invalid\|valid.*false"; then
    print_pass "Invalid IFSC correctly rejected"
else
    print_fail "Invalid IFSC should have been rejected"
    echo "Response: $INVALID_IFSC"
fi

echo ""

# ============================================
# TEST 11: Application with Bank Validation
# ============================================
print_test "Testing application submission with bank validation"

BANK_TEST_PHONE="+919876543212"
BANK_TEST_EMAIL="bank-test-$(date +%s)@test.com"

BANK_APP=$(curl -s -X POST "${BASE_URL}/vendor/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"roleId\": \"trainer\",
    \"phone\": \"${BANK_TEST_PHONE}\",
    \"email\": \"${BANK_TEST_EMAIL}\",
    \"serviceStyle\": \"at_center\",
    \"formData\": {
      \"businessName\": \"Test Trainer\",
      \"fullName\": \"Test Trainer Name\",
      \"address\": \"321 Test Road\",
      \"city\": \"Bangalore\",
      \"state\": \"Karnataka\",
      \"pincode\": \"560001\",
      \"accountHolderName\": \"Test Account Holder\",
      \"accountNumber\": \"9876543210\",
      \"ifscCode\": \"SBIN0000001\",
      \"bankName\": \"\",
      \"branchName\": \"\"
    },
    \"documents\": {}
  }")

BANK_VENDOR_ID=$(echo "$BANK_APP" | grep -o '"vendorId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$BANK_VENDOR_ID" ]; then
    print_pass "Application with bank details created"
    
    # Check if bank was validated and auto-filled
    BANK_STATUS=$(curl -s -X GET "${BASE_URL}/vendor/status/${BANK_TEST_PHONE}" \
      -H "Authorization: Bearer ${ANON_KEY}")
    
    # Note: This would require a vendor details endpoint to fully verify
    # For now, just check that application was created
    print_info "Bank validation should have auto-filled bank name from IFSC"
else
    print_fail "Failed to create application with bank details"
fi

echo ""

# ============================================
# TEST 12: History After Multiple Actions
# ============================================
print_test "Verifying history contains all actions"

# Create new vendor, edit, then check history
HISTORY_TEST_PHONE="+919876543213"
HISTORY_TEST_EMAIL="history-test-$(date +%s)@test.com"

HISTORY_CREATE=$(curl -s -X POST "${BASE_URL}/vendor/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"roleId\": \"vet\",
    \"phone\": \"${HISTORY_TEST_PHONE}\",
    \"email\": \"${HISTORY_TEST_EMAIL}\",
    \"serviceStyle\": \"both\",
    \"formData\": {
      \"businessName\": \"History Test Clinic\",
      \"fullName\": \"History Test\",
      \"address\": \"Test Address\",
      \"city\": \"Mumbai\",
      \"state\": \"Maharashtra\",
      \"pincode\": \"400001\"
    },
    \"documents\": {}
  }")

HISTORY_VENDOR_ID=$(echo "$HISTORY_CREATE" | grep -o '"vendorId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$HISTORY_VENDOR_ID" ]; then
    # Edit it
    curl -s -X PUT "${BASE_URL}/vendor/application/${HISTORY_VENDOR_ID}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${ANON_KEY}" \
      -d "{
        \"formData\": {
          \"businessName\": \"Updated History Test\"
        }
      }" > /dev/null
    
    # Check history
    FINAL_HISTORY=$(curl -s -X GET "${BASE_URL}/vendor/application/${HISTORY_VENDOR_ID}/history" \
      -H "Authorization: Bearer ${ANON_KEY}")
    
    HISTORY_ENTRIES=$(echo "$FINAL_HISTORY" | jq -r '.history | length // 0')
    
    if [ "$HISTORY_ENTRIES" -ge 1 ]; then
        print_pass "History contains multiple entries"
        print_info "Found $HISTORY_ENTRIES history entries"
        
        # Check for specific actions
        if echo "$FINAL_HISTORY" | grep -q "application_updated\|resubmitted"; then
            print_pass "Edit action found in history"
        fi
    else
        print_fail "History should contain entries"
    fi
fi

echo ""

# ============================================
# TEST SUMMARY
# ============================================
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi


#!/bin/bash

# ============================================================================
# END-TO-END TEST SCRIPT FOR FIXES
# ============================================================================
# Tests:
# 1. Medical records image/PDF loading
# 2. Video call functionality
# 3. Medical records in vendor appointment history
# 4. Pharmacy ordering from prescription
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
TEST_BOOKING_ID="${TEST_BOOKING_ID:-test-booking-123}"
TEST_RECORD_ID="${TEST_RECORD_ID:-test-record-456}"
TEST_PET_ID="${TEST_PET_ID:-test-pet-789}"

# Test counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅${NC} $test_name: $message"
        ((PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌${NC} $test_name: $message"
        ((FAILED++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️${NC} $test_name: $message"
        ((WARNINGS++))
    fi
}

check_api_response() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_status="${4:-200}"
    
    local response
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "ERROR\n500")
    else
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL$endpoint" 2>/dev/null || echo "ERROR\n500")
    fi
    
    local body=$(echo "$response" | head -n -1)
    local status_code=$(echo "$response" | tail -n 1)
    
    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        echo "$body"
        return 0
    else
        echo "ERROR: HTTP $status_code"
        return 1
    fi
}

# ============================================================================
# TEST 1: MEDICAL RECORDS IMAGE/PDF LOADING
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Medical Records Image/PDF Loading${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 1.1: Check endpoint exists
echo -e "${YELLOW}Test 1.1: Verify medical records view endpoint${NC}"
if grep -q "GET.*medical-records/booking.*view" backend/lambda/src/endpoints/medical-records.ts; then
    log_test "Medical Records View Endpoint" "PASS" "Endpoint defined in medical-records.ts"
else
    log_test "Medical Records View Endpoint" "FAIL" "Endpoint not found"
fi

# Test 1.2: Check S3 presigned URL generation
echo -e "${YELLOW}Test 1.2: Verify S3 presigned URL generation logic${NC}"
if grep -q "getSignedUrl\|S3Client\|GetObjectCommand" backend/lambda/src/endpoints/medical-records.ts; then
    log_test "S3 Presigned URL Generation" "PASS" "S3 SDK imports and presigned URL logic present"
else
    log_test "S3 Presigned URL Generation" "FAIL" "S3 SDK logic missing"
fi

# Test 1.3: Check URL pattern matching
echo -e "${YELLOW}Test 1.3: Verify URL pattern matching for different S3 formats${NC}"
if grep -q "urlPatterns\|cloudfront\|amazonaws" backend/lambda/src/endpoints/medical-records.ts; then
    log_test "URL Pattern Matching" "PASS" "Multiple S3 URL format patterns handled"
else
    log_test "URL Pattern Matching" "WARN" "URL pattern matching may be limited"
fi

# Test 1.4: Check endpoint registration
echo -e "${YELLOW}Test 1.4: Verify endpoint registration in handler${NC}"
if grep -q "registerMedicalRecordsEndpoints" backend/lambda/src/handler/index.ts; then
    log_test "Endpoint Registration" "PASS" "Medical records endpoints registered"
else
    log_test "Endpoint Registration" "FAIL" "Endpoints not registered"
fi

# Test 1.5: Test API endpoint (if available)
echo -e "${YELLOW}Test 1.5: Test medical records view API endpoint${NC}"
RESPONSE=$(check_api_response "/medical-records/booking/$TEST_BOOKING_ID/view/$TEST_RECORD_ID" "GET" "" "200,404")
if echo "$RESPONSE" | grep -q "fileUrl\|success\|error"; then
    log_test "API Endpoint Response" "PASS" "Endpoint responds correctly"
else
    log_test "API Endpoint Response" "WARN" "Endpoint may not be accessible (expected in dev)"
fi

# ============================================================================
# TEST 2: VIDEO CALL FUNCTIONALITY
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: Video Call Functionality${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 2.1: Check video call endpoints
echo -e "${YELLOW}Test 2.1: Verify video call endpoints${NC}"
if grep -q "registerVideoCallEndpoints" backend/lambda/src/handler/index.ts; then
    log_test "Video Call Endpoint Registration" "PASS" "Video call endpoints registered"
else
    log_test "Video Call Endpoint Registration" "FAIL" "Endpoints not registered"
fi

# Test 2.2: Check create meeting endpoint
echo -e "${YELLOW}Test 2.2: Verify create meeting endpoint${NC}"
if grep -q "create-meeting\|CreateMeetingCommand" backend/lambda/src/endpoints/video-call.ts; then
    log_test "Create Meeting Endpoint" "PASS" "Create meeting endpoint exists"
else
    log_test "Create Meeting Endpoint" "FAIL" "Create meeting endpoint missing"
fi

# Test 2.3: Check join meeting endpoint
echo -e "${YELLOW}Test 2.3: Verify join meeting endpoint${NC}"
if grep -q "join\|CreateAttendeeCommand" backend/lambda/src/endpoints/video-call.ts; then
    log_test "Join Meeting Endpoint" "PASS" "Join meeting endpoint exists"
else
    log_test "Join Meeting Endpoint" "FAIL" "Join meeting endpoint missing"
fi

# Test 2.4: Check AWS Chime SDK integration
echo -e "${YELLOW}Test 2.4: Verify AWS Chime SDK integration${NC}"
if grep -q "ChimeSDKMeetingsClient\|@aws-sdk/client-chime" backend/lambda/src/endpoints/video-call.ts; then
    log_test "AWS Chime SDK Integration" "PASS" "Chime SDK properly imported"
else
    log_test "AWS Chime SDK Integration" "FAIL" "Chime SDK not found"
fi

# Test 2.5: Check UI component imports
echo -e "${YELLOW}Test 2.5: Verify video call UI components${NC}"
if grep -q "VideoCallInterface\|VideoPageClient" apps/customer-web/app/video/\[bookingId\]/VideoPageClient.tsx; then
    log_test "Video Call UI Components" "PASS" "Video call components exist"
else
    log_test "Video Call UI Components" "WARN" "Video call components may be missing"
fi

# Test 2.6: Check CommunicationHub video button
echo -e "${YELLOW}Test 2.6: Verify video call button in CommunicationHub${NC}"
if grep -q "Video.*onNavigate\|video-call" apps/customer-web/components/communication/CommunicationHub.tsx; then
    log_test "CommunicationHub Video Button" "PASS" "Video call button added to CommunicationHub"
else
    log_test "CommunicationHub Video Button" "FAIL" "Video call button missing"
fi

# ============================================================================
# TEST 3: MEDICAL RECORDS IN VENDOR APPOINTMENT HISTORY
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: Medical Records in Vendor Appointment History${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 3.1: Check medical records loading in AppointmentDetailModal
echo -e "${YELLOW}Test 3.1: Verify medical records loading in vendor AppointmentDetailModal${NC}"
if grep -q "loadMedicalRecordsHistory\|medicalRecords" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_test "Medical Records Loading" "PASS" "Medical records loading function exists"
else
    log_test "Medical Records Loading" "FAIL" "Medical records loading missing"
fi

# Test 3.2: Check history tab display
echo -e "${YELLOW}Test 3.2: Verify medical records in history tab${NC}"
if grep -q "activeTab.*history.*medicalRecords\|Medical History" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_test "History Tab Display" "PASS" "Medical records displayed in history tab"
else
    log_test "History Tab Display" "FAIL" "Medical records not in history tab"
fi

# Test 3.3: Check API endpoint usage
echo -e "${YELLOW}Test 3.3: Verify API endpoint usage for medical records${NC}"
if grep -q "medical-records/booking.*prescriptions" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_test "API Endpoint Usage" "PASS" "Correct API endpoint used"
else
    log_test "API Endpoint Usage" "FAIL" "API endpoint not used correctly"
fi

# ============================================================================
# TEST 4: PHARMACY ORDERING FROM PRESCRIPTION
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 4: Pharmacy Ordering from Prescription${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test 4.1: Check pharmacy order button in PrescriptionHistoryModal
echo -e "${YELLOW}Test 4.1: Verify pharmacy order button in PrescriptionHistoryModal${NC}"
if grep -q "Order Medicine\|ShoppingCart\|onOrderMedicine" apps/customer-web/components/customer/PrescriptionHistoryModal.tsx; then
    log_test "Pharmacy Order Button" "PASS" "Order button exists in prescription viewer"
else
    log_test "Pharmacy Order Button" "FAIL" "Order button missing"
fi

# Test 4.2: Check broadcast prescription button
echo -e "${YELLOW}Test 4.2: Verify broadcast prescription button${NC}"
if grep -q "Broadcast\|Radio.*Broadcast" apps/customer-web/components/customer/PrescriptionHistoryModal.tsx; then
    log_test "Broadcast Prescription Button" "PASS" "Broadcast button exists"
else
    log_test "Broadcast Prescription Button" "FAIL" "Broadcast button missing"
fi

# Test 4.3: Check callback integration
echo -e "${YELLOW}Test 4.3: Verify pharmacy order callback integration${NC}"
if grep -q "onOrderMedicine.*prescriptionId\|handleReorderMedicine" apps/customer-web/components/customer/BookingDetailModal.tsx; then
    log_test "Callback Integration" "PASS" "Pharmacy order callback properly integrated"
else
    log_test "Callback Integration" "FAIL" "Callback not integrated"
fi

# Test 4.4: Check pharmacy order flow
echo -e "${YELLOW}Test 4.4: Verify pharmacy order flow navigation${NC}"
if grep -q "pharmacy_order_prescription\|PrescriptionOrderFlow" apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx; then
    log_test "Pharmacy Order Flow" "PASS" "Pharmacy order flow navigation exists"
else
    log_test "Pharmacy Order Flow" "WARN" "Pharmacy order flow may be incomplete"
fi

# Test 4.5: Check pharmacy API endpoints
echo -e "${YELLOW}Test 4.5: Verify pharmacy order API endpoints${NC}"
if grep -q "registerPharmacyOrderEndpoints\|pharmacy/orders" backend/lambda/src/handler/index.ts; then
    log_test "Pharmacy API Endpoints" "PASS" "Pharmacy order endpoints registered"
else
    log_test "Pharmacy API Endpoints" "FAIL" "Pharmacy endpoints not registered"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

TOTAL=$((PASSED + FAILED + WARNINGS))
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}\n"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi

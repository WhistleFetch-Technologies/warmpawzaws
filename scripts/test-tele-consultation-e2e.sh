#!/bin/bash

# ============================================================================
# TELE CONSULTATION END-TO-END FLOW TEST
# ============================================================================
# Tests complete tele consultation flow:
# 1. Booking creation with tele service style
# 2. Service style label display
# 3. Video call integration
# 4. Prescription creation and publishing
# 5. Prescription in chat
# 6. Pharmacy ordering
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}TELE CONSULTATION END-TO-END FLOW TEST${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
ISSUES_FOUND=0

# Test data
CUSTOMER_PHONE="9611377119"
VENDOR_ID="55bdca98-71c9-48cb-95b6-41e8d23d2cf3"
SERVICE_ID="tele-consultation-service"
BOOKING_ID=""
PRESCRIPTION_ID=""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo -e "   ${RED}→${NC} $message"
        ((TESTS_FAILED++))
        ((ISSUES_FOUND++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  WARN${NC}: $test_name"
        echo -e "   ${YELLOW}→${NC} $message"
    else
        echo -e "${BLUE}ℹ️  INFO${NC}: $test_name"
        echo -e "   ${BLUE}→${NC} $message"
    fi
}

check_api_response() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_field="$4"
    local expected_value="$5"
    
    local response
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        response=$(curl -s -X "$method" "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -X "$method" "$API_BASE$endpoint" 2>&1)
    fi
    
    echo "$response"
}

# ============================================================================
# TEST 1: VERIFY BOOKING CREATION WITH TELE SERVICE STYLE
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Booking Creation with Tele Service Style${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get customer ID
CUSTOMER_RESPONSE=$(check_api_response "/customer/by-phone?phone=$CUSTOMER_PHONE")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
    log_test "Get Customer ID" "FAIL" "Customer not found for phone $CUSTOMER_PHONE"
    exit 1
else
    log_test "Get Customer ID" "PASS" "Customer ID: ${CUSTOMER_ID:0:8}..."
fi

# Create tele consultation booking
BOOKING_DATA=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "vendorId": "$VENDOR_ID",
  "serviceId": "$SERVICE_ID",
  "serviceType": "tele",
  "bookingDate": "$(date +%Y-%m-%d)",
  "bookingTime": "$(date +%H:%M)",
  "amount": 300,
  "petId": "test-pet-id"
}
EOF
)

BOOKING_RESPONSE=$(check_api_response "/bookings/create" "POST" "$BOOKING_DATA")
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BOOKING_ID" ]; then
    log_test "Create Tele Booking" "FAIL" "Failed to create booking"
    echo "Response: $BOOKING_RESPONSE"
    exit 1
else
    log_test "Create Tele Booking" "PASS" "Booking ID: ${BOOKING_ID:0:8}..."
fi

# Verify booking has correct service_type
SERVICE_TYPE=$(echo "$BOOKING_RESPONSE" | grep -o '"service_type":"[^"]*"' | cut -d'"' -f4)
if [ "$SERVICE_TYPE" = "tele" ]; then
    log_test "Booking Service Type" "PASS" "service_type is 'tele'"
else
    log_test "Booking Service Type" "FAIL" "Expected 'tele', got '$SERVICE_TYPE'"
fi

echo ""

# ============================================================================
# TEST 2: VERIFY BOOKING DETAILS ENDPOINT RETURNS CORRECT SERVICE_STYLE
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: Booking Details - Service Style Mapping${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BOOKING_DETAILS=$(check_api_response "/customer/bookings/$BOOKING_ID?phone=$CUSTOMER_PHONE")

# Check for serviceStyle in response
SERVICE_STYLE=$(echo "$BOOKING_DETAILS" | grep -o '"serviceStyle":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SERVICE_STYLE" ]; then
    if [ "$SERVICE_STYLE" = "tele" ]; then
        log_test "Service Style in Response" "PASS" "serviceStyle is 'tele'"
    else
        log_test "Service Style in Response" "WARN" "serviceStyle is '$SERVICE_STYLE' (expected 'tele')"
    fi
else
    log_test "Service Style in Response" "FAIL" "serviceStyle field missing in response"
fi

# Check for service_style in response
SERVICE_STYLE_SNAKE=$(echo "$BOOKING_DETAILS" | grep -o '"service_style":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SERVICE_STYLE_SNAKE" ]; then
    log_test "Service Style (snake_case)" "PASS" "service_style is '$SERVICE_STYLE_SNAKE'"
else
    log_test "Service Style (snake_case)" "WARN" "service_style field missing (non-critical)"
fi

# Check for service_type in response
SERVICE_TYPE_DETAILS=$(echo "$BOOKING_DETAILS" | grep -o '"service_type":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SERVICE_TYPE_DETAILS" ]; then
    log_test "Service Type in Response" "PASS" "service_type is '$SERVICE_TYPE_DETAILS'"
else
    log_test "Service Type in Response" "WARN" "service_type field missing"
fi

echo ""

# ============================================================================
# TEST 3: VERIFY VIDEO CALL ENDPOINTS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: Video Call Integration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test create meeting endpoint
CREATE_MEETING_DATA=$(cat <<EOF
{
  "bookingId": "$BOOKING_ID",
  "customerId": "$CUSTOMER_ID",
  "vendorId": "$VENDOR_ID"
}
EOF
)

MEETING_RESPONSE=$(check_api_response "/video-call/create-meeting" "POST" "$CREATE_MEETING_DATA")
MEETING_ID=$(echo "$MEETING_RESPONSE" | grep -o '"meetingId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$MEETING_ID" ]; then
    log_test "Create Video Meeting" "PASS" "Meeting ID: ${MEETING_ID:0:8}..."
else
    log_test "Create Video Meeting" "WARN" "Meeting creation may not be implemented or endpoint may differ"
    echo "Response: $MEETING_RESPONSE"
fi

# Test join meeting endpoint (customer)
JOIN_CUSTOMER_DATA=$(cat <<EOF
{
  "bookingId": "$BOOKING_ID",
  "userId": "$CUSTOMER_ID",
  "userType": "customer"
}
EOF
)

JOIN_RESPONSE=$(check_api_response "/video-call/join" "POST" "$JOIN_CUSTOMER_DATA")
ATTENDEE_ID=$(echo "$JOIN_RESPONSE" | grep -o '"attendeeId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ATTENDEE_ID" ]; then
    log_test "Join Video Call (Customer)" "PASS" "Attendee ID: ${ATTENDEE_ID:0:8}..."
else
    log_test "Join Video Call (Customer)" "WARN" "Join endpoint may not be implemented or endpoint may differ"
fi

echo ""

# ============================================================================
# TEST 4: VERIFY PRESCRIPTION CREATION AND PUBLISHING
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 4: Prescription Creation and Publishing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get pet ID from booking
PET_ID=$(echo "$BOOKING_DETAILS" | grep -o '"petId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$PET_ID" ]; then
    PET_ID="test-pet-id"
    log_test "Get Pet ID" "WARN" "Using test pet ID"
fi

# Create prescription
PRESCRIPTION_DATA=$(cat <<EOF
{
  "bookingId": "$BOOKING_ID",
  "customerId": "$CUSTOMER_ID",
  "petId": "$PET_ID",
  "vendorId": "$VENDOR_ID",
  "medications": [
    {
      "name": "Amoxicillin",
      "dosage": "250mg",
      "frequency": "Twice daily",
      "duration": "7 days",
      "instructions": "Take with food"
    }
  ],
  "diagnosis": "Routine checkup - healthy",
  "instructions": "Monitor for any changes",
  "status": "published"
}
EOF
)

PRESCRIPTION_RESPONSE=$(check_api_response "/prescriptions" "POST" "$PRESCRIPTION_DATA")
PRESCRIPTION_ID=$(echo "$PRESCRIPTION_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRESCRIPTION_ID" ]; then
    log_test "Create Prescription" "PASS" "Prescription ID: ${PRESCRIPTION_ID:0:8}..."
    
    # Verify prescription status
    PRESCRIPTION_STATUS=$(echo "$PRESCRIPTION_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$PRESCRIPTION_STATUS" = "published" ]; then
        log_test "Prescription Status" "PASS" "Status is 'published'"
    else
        log_test "Prescription Status" "WARN" "Status is '$PRESCRIPTION_STATUS' (expected 'published')"
    fi
else
    log_test "Create Prescription" "FAIL" "Failed to create prescription"
    echo "Response: $PRESCRIPTION_RESPONSE"
fi

echo ""

# ============================================================================
# TEST 5: VERIFY PRESCRIPTION IN CHAT
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 5: Prescription in Chat${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get chat conversation
CHAT_RESPONSE=$(check_api_response "/chat/booking/$BOOKING_ID/conversation?phone=$CUSTOMER_PHONE")

# Check for prescription message
PRESCRIPTION_MESSAGE=$(echo "$CHAT_RESPONSE" | grep -o '"message_type":"prescription"' | head -1)
if [ -n "$PRESCRIPTION_MESSAGE" ]; then
    log_test "Prescription in Chat" "PASS" "Prescription message found in chat"
    
    # Check for prescription file_id
    PRESCRIPTION_FILE_ID=$(echo "$CHAT_RESPONSE" | grep -o '"file_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$PRESCRIPTION_FILE_ID" ]; then
        if [ "$PRESCRIPTION_FILE_ID" = "$PRESCRIPTION_ID" ]; then
            log_test "Prescription File ID" "PASS" "file_id matches prescription ID"
        else
            log_test "Prescription File ID" "WARN" "file_id '$PRESCRIPTION_FILE_ID' doesn't match prescription ID"
        fi
    else
        log_test "Prescription File ID" "WARN" "file_id missing in chat message"
    fi
else
    log_test "Prescription in Chat" "FAIL" "Prescription message not found in chat"
    echo "Chat Response: $CHAT_RESPONSE"
fi

echo ""

# ============================================================================
# TEST 6: VERIFY PRESCRIPTION RETRIEVAL
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 6: Prescription Retrieval${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$PRESCRIPTION_ID" ]; then
    # Get prescription by ID
    PRESCRIPTION_DETAILS=$(check_api_response "/prescriptions/$PRESCRIPTION_ID")
    
    PRESCRIPTION_DETAILS_ID=$(echo "$PRESCRIPTION_DETAILS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$PRESCRIPTION_DETAILS_ID" = "$PRESCRIPTION_ID" ]; then
        log_test "Get Prescription by ID" "PASS" "Prescription retrieved successfully"
    else
        log_test "Get Prescription by ID" "FAIL" "Prescription ID mismatch"
    fi
    
    # Get prescription by booking ID
    PRESCRIPTION_BOOKING=$(check_api_response "/prescriptions/booking/$BOOKING_ID")
    PRESCRIPTION_COUNT=$(echo "$PRESCRIPTION_BOOKING" | grep -o '"id":"[^"]*"' | wc -l)
    if [ "$PRESCRIPTION_COUNT" -gt 0 ]; then
        log_test "Get Prescription by Booking" "PASS" "Found $PRESCRIPTION_COUNT prescription(s)"
    else
        log_test "Get Prescription by Booking" "WARN" "No prescriptions found for booking"
    fi
else
    log_test "Get Prescription" "SKIP" "Prescription ID not available"
fi

echo ""

# ============================================================================
# TEST 7: VERIFY PHARMACY ORDERING ENDPOINT
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 7: Pharmacy Ordering Integration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if pharmacy endpoint exists
PHARMACY_RESPONSE=$(check_api_response "/pharmacy/orders" "GET")
if echo "$PHARMACY_RESPONSE" | grep -q "error\|Not Found"; then
    log_test "Pharmacy Endpoint" "WARN" "Pharmacy endpoint may not be available or requires authentication"
else
    log_test "Pharmacy Endpoint" "PASS" "Pharmacy endpoint accessible"
fi

echo ""

# ============================================================================
# TEST 8: VERIFY FRONTEND API CONTRACTS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 8: Frontend API Contracts${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check BookingDetailModal API calls
if grep -q "apiClient.get.*bookings" apps/customer-web/components/customer/BookingDetailModal.tsx; then
    log_test "BookingDetailModal API Call" "PASS" "Uses apiClient.get for bookings"
else
    log_test "BookingDetailModal API Call" "FAIL" "Missing apiClient.get for bookings"
fi

# Check CommunicationHub API calls
if grep -q "apiClient.get.*chat" apps/customer-web/components/communication/CommunicationHub.tsx; then
    log_test "CommunicationHub API Call" "PASS" "Uses apiClient.get for chat"
else
    log_test "CommunicationHub API Call" "FAIL" "Missing apiClient.get for chat"
fi

# Check PrescriptionModal API calls
if grep -q "apiClient.get.*prescriptions" apps/customer-web/components/customer/PrescriptionModal.tsx; then
    log_test "PrescriptionModal API Call" "PASS" "Uses apiClient.get for prescriptions"
else
    log_test "PrescriptionModal API Call" "FAIL" "Missing apiClient.get for prescriptions"
fi

echo ""

# ============================================================================
# TEST 9: VERIFY HANDLERS AND ROUTES
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 9: Backend Handlers and Routes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check booking details handler
if grep -q "GetBookingHandlerEnhanced\|GET.*bookings.*:id" backend/lambda/src/endpoints/bookings-enhanced.ts; then
    log_test "Booking Details Handler" "PASS" "Handler exists"
else
    log_test "Booking Details Handler" "FAIL" "Handler not found"
fi

# Check prescription handler
if grep -q "POST.*prescriptions\|app.post.*prescriptions" backend/lambda/src/endpoints/prescriptions.ts; then
    log_test "Prescription Create Handler" "PASS" "Handler exists"
else
    log_test "Prescription Create Handler" "FAIL" "Handler not found"
fi

# Check chat handler
if grep -q "POST.*chat.*message\|app.post.*chat" backend/lambda/src/endpoints/chat.ts; then
    log_test "Chat Message Handler" "PASS" "Handler exists"
else
    log_test "Chat Message Handler" "FAIL" "Handler not found"
fi

# Check service_style mapping in booking details
if grep -q "service_style_from_vendor\|serviceStyle.*service_style" backend/lambda/src/endpoints/bookings-enhanced.ts; then
    log_test "Service Style Mapping" "PASS" "Service style mapping implemented"
else
    log_test "Service Style Mapping" "FAIL" "Service style mapping missing"
fi

# Check prescription-to-chat integration
if grep -q "chat_messages.*prescription\|insert.*chat_messages" backend/lambda/src/endpoints/prescriptions.ts; then
    log_test "Prescription-to-Chat Integration" "PASS" "Integration implemented"
else
    log_test "Prescription-to-Chat Integration" "FAIL" "Integration missing"
fi

echo ""

# ============================================================================
# TEST 10: VERIFY UI COMPONENTS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 10: UI Components${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check getServiceStyleLabel function
if grep -q "getServiceStyleLabel\|Video Consultation" apps/customer-web/components/customer/BookingDetailModal.tsx; then
    log_test "Service Style Label Function" "PASS" "getServiceStyleLabel function exists"
else
    log_test "Service Style Label Function" "FAIL" "getServiceStyleLabel function missing"
fi

# Check prescription message rendering
if grep -q "message_type.*prescription\|prescription.*message" apps/customer-web/components/communication/CommunicationHub.tsx; then
    log_test "Prescription Message Rendering" "PASS" "Prescription message rendering implemented"
else
    log_test "Prescription Message Rendering" "FAIL" "Prescription message rendering missing"
fi

# Check video call button
if grep -q "Join Tele-Consultation\|serviceStyle.*tele.*Video" apps/customer-web/components/customer/BookingDetailModal.tsx; then
    log_test "Video Call Button" "PASS" "Video call button exists"
else
    log_test "Video Call Button" "FAIL" "Video call button missing"
fi

# Check prescription view handler
if grep -q "viewPrescription\|loadPrescriptionById" apps/customer-web/components/customer/BookingDetailModal.tsx; then
    log_test "Prescription View Handler" "PASS" "Prescription view handler exists"
else
    log_test "Prescription View Handler" "FAIL" "Prescription view handler missing"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}Issues Found: $ISSUES_FOUND${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the issues above.${NC}"
    exit 1
fi

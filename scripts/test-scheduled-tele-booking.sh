#!/bin/bash

# ============================================================================
# Test Scheduled Tele Consultation Booking Creation
# ============================================================================
# 
# This script tests the scheduled tele consultation booking creation endpoint
# to verify that:
# 1. Non-UUID serviceIds are properly resolved
# 2. UUID serviceIds work correctly
# 3. Vendor ID is properly handled
# 4. Booking is created successfully
#
# Usage:
#   bash scripts/test-scheduled-tele-booking.sh
# ============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo "🧪 Testing Scheduled Tele Consultation Booking Creation"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Get a customer ID (using phone number)
echo "${YELLOW}📋 Test 1: Fetching customer ID...${NC}"
CUSTOMER_PHONE="9611377119"
CUSTOMER_RESPONSE=$(curl -s "${API_BASE_URL}/customer/profile?phone=${CUSTOMER_PHONE}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
  echo "${RED}❌ Failed to get customer ID${NC}"
  echo "Response: $CUSTOMER_RESPONSE"
  exit 1
fi

echo "${GREEN}✅ Customer ID: ${CUSTOMER_ID}${NC}"
echo ""

# Test 2: Get a pet ID
echo "${YELLOW}📋 Test 2: Fetching pet ID...${NC}"
PET_RESPONSE=$(curl -s "${API_BASE_URL}/customer/pets/${CUSTOMER_PHONE}")
PET_ID=$(echo "$PET_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PET_ID" ]; then
  echo "${RED}❌ Failed to get pet ID${NC}"
  echo "Response: $PET_RESPONSE"
  exit 1
fi

echo "${GREEN}✅ Pet ID: ${PET_ID}${NC}"
echo ""

# Test 3: Get a vendor/provider ID for tele consultation
echo "${YELLOW}📋 Test 3: Fetching tele consultation provider...${NC}"
PROVIDER_RESPONSE=$(curl -s "${API_BASE_URL}/customer/tele/available-providers?roleId=veterinarian&availableIn=5")
VENDOR_ID=$(echo "$PROVIDER_RESPONSE" | grep -o '"vendorId":"[^"]*"' | head -1 | cut -d'"' -f4)
STAFF_ID=$(echo "$PROVIDER_RESPONSE" | grep -o '"staffId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$VENDOR_ID" ]; then
  echo "${YELLOW}⚠️  No vendor found, will test with platform service${NC}"
  VENDOR_ID=""
else
  echo "${GREEN}✅ Vendor ID: ${VENDOR_ID}${NC}"
fi

if [ ! -z "$STAFF_ID" ]; then
  echo "${GREEN}✅ Staff ID: ${STAFF_ID}${NC}"
fi
echo ""

# Test 4: Get service ID from vendor's services (for scheduled booking)
echo "${YELLOW}📋 Test 4: Fetching tele consultation service from vendor...${NC}"
if [ ! -z "$VENDOR_ID" ]; then
  # Try to get services from the vendor
  VENDOR_SERVICES_RESPONSE=$(curl -s "${API_BASE_URL}/customer/vendor/${VENDOR_ID}/services?serviceStyle=tele" || echo "")
  SERVICE_ID=$(echo "$VENDOR_SERVICES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  SERVICE_NAME=$(echo "$VENDOR_SERVICES_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  
  if [ -z "$SERVICE_ID" ]; then
    # Fallback: try platform services
    PLATFORM_SERVICES_RESPONSE=$(curl -s "${API_BASE_URL}/customer/services/platform?roleId=veterinarian&serviceStyle=tele")
    SERVICE_ID=$(echo "$PLATFORM_SERVICES_RESPONSE" | grep -o '"serviceId":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  fi
fi

if [ -z "$SERVICE_ID" ]; then
  SERVICE_ID="vet_tele_consult"
  echo "${YELLOW}⚠️  Using default service ID: ${SERVICE_ID}${NC}"
  echo "${YELLOW}   Note: This may fail if the service doesn't exist in the database${NC}"
else
  echo "${GREEN}✅ Service ID: ${SERVICE_ID}${NC}"
  if [ ! -z "$SERVICE_NAME" ]; then
    echo "${GREEN}   Service Name: ${SERVICE_NAME}${NC}"
  fi
fi
echo ""

# Test 5: Create booking with non-UUID serviceId (if serviceId is not UUID)
echo "${YELLOW}📋 Test 5: Creating scheduled tele consultation booking...${NC}"

# Calculate booking date (tomorrow)
BOOKING_DATE=$(date -u -v+1d +"%Y-%m-%d" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%d" 2>/dev/null || date +"%Y-%m-%d")
BOOKING_TIME="10:00"

# Build JSON payload - conditionally include staffId only if it's a valid UUID
if [ ! -z "$STAFF_ID" ] && [[ "$STAFF_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  BOOKING_PAYLOAD=$(cat <<EOF
{
  "customerId": "${CUSTOMER_ID}",
  "vendorId": "${VENDOR_ID}",
  "serviceId": "${SERVICE_ID}",
  "staffId": "${STAFF_ID}",
  "bookingDate": "${BOOKING_DATE}",
  "bookingTime": "${BOOKING_TIME}",
  "serviceType": "tele",
  "petId": "${PET_ID}",
  "amount": 500,
  "notes": "Test scheduled tele consultation booking"
}
EOF
)
else
  BOOKING_PAYLOAD=$(cat <<EOF
{
  "customerId": "${CUSTOMER_ID}",
  "vendorId": "${VENDOR_ID}",
  "serviceId": "${SERVICE_ID}",
  "bookingDate": "${BOOKING_DATE}",
  "bookingTime": "${BOOKING_TIME}",
  "serviceType": "tele",
  "petId": "${PET_ID}",
  "amount": 500,
  "notes": "Test scheduled tele consultation booking"
}
EOF
)
fi

echo "Request payload:"
echo "$BOOKING_PAYLOAD" | jq '.' 2>/dev/null || echo "$BOOKING_PAYLOAD"
echo ""

BOOKING_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "${API_BASE_URL}/bookings/create" \
  -H "Content-Type: application/json" \
  -d "$BOOKING_PAYLOAD")

HTTP_STATUS=$(echo "$BOOKING_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$BOOKING_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response (HTTP ${HTTP_STATUS}):"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  BOOKING_ID=$(echo "$RESPONSE_BODY" | grep -o '"bookingId":"[^"]*"' | cut -d'"' -f4 || echo "$RESPONSE_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ ! -z "$BOOKING_ID" ]; then
    echo "${GREEN}✅ SUCCESS: Booking created with ID: ${BOOKING_ID}${NC}"
    echo ""
    
    # Test 6: Verify booking was created
    echo "${YELLOW}📋 Test 6: Verifying booking...${NC}"
    GET_BOOKING_RESPONSE=$(curl -s "${API_BASE_URL}/customer/bookings/${BOOKING_ID}" || curl -s "${API_BASE_URL}/bookings/${BOOKING_ID}")
    echo "$GET_BOOKING_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_BOOKING_RESPONSE"
    echo ""
    
    if echo "$GET_BOOKING_RESPONSE" | grep -q "$BOOKING_ID"; then
      echo "${GREEN}✅ Booking verified successfully!${NC}"
    else
      echo "${YELLOW}⚠️  Booking ID found but verification incomplete${NC}"
    fi
  else
    echo "${YELLOW}⚠️  Booking created but ID not found in response${NC}"
  fi
else
  echo "${RED}❌ FAILED: Booking creation failed with HTTP ${HTTP_STATUS}${NC}"
  echo ""
  echo "Error details:"
  echo "$RESPONSE_BODY" | jq '.error, .details, .message' 2>/dev/null || echo "$RESPONSE_BODY"
  exit 1
fi

echo ""
echo "${GREEN}✅ All tests completed!${NC}"

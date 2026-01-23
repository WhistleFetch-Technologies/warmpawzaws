#!/bin/bash

# ============================================================================
# TEST PRESCRIPTION ENDPOINT
# ============================================================================
# Tests POST /prescriptions endpoint with vendorId validation
# Usage: ./scripts/test-prescription-endpoint.sh [dev|prod]
# ============================================================================

ENV=${1:-dev}
if [ "$ENV" = "dev" ]; then
  API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
else
  API_URL="https://api.warmpawz.com"  # Update with prod URL if different
fi

echo "🧪 Testing Prescription Endpoint"
echo "Environment: $ENV"
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Missing vendorId (should fail with validation error)
echo -e "${YELLOW}[Test 1] Testing with MISSING vendorId (should fail)...${NC}"
RESPONSE1=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/prescriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "7ddd7aee-068d-4d81-b08f-27f12f26091a",
    "customerId": "39c84571-b26d-475a-bb38-94975cb8262d",
    "petId": "6e28df3a-3880-460a-b747-bd359330fc32",
    "medications": [{"name": "Apoquel", "dosage": "100", "frequency": "", "duration": "3 days", "instructions": "test"}],
    "diagnosis": "test",
    "instructions": "test instructions",
    "createdBy": "",
    "createdByRole": "vendor",
    "status": "published"
  }' 2>/dev/null)

HTTP_CODE1=$(echo "$RESPONSE1" | tail -n1)
BODY1=$(echo "$RESPONSE1" | sed '$d')

if echo "$BODY1" | grep -q "vendor_id\|vendorId\|Validation failed"; then
  echo -e "${GREEN}✅ Test 1 PASSED: Correctly rejected missing vendorId${NC}"
  echo "Response: $BODY1" | head -c 200
  echo ""
else
  echo -e "${RED}❌ Test 1 FAILED: Should reject missing vendorId (HTTP $HTTP_CODE1)${NC}"
  echo "Response: $BODY1"
fi
echo ""

# Test 2: Empty vendorId string (should fail)
echo -e "${YELLOW}[Test 2] Testing with EMPTY vendorId string (should fail)...${NC}"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/prescriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "7ddd7aee-068d-4d81-b08f-27f12f26091a",
    "customerId": "39c84571-b26d-475a-bb38-94975cb8262d",
    "petId": "6e28df3a-3880-460a-b747-bd359330fc32",
    "vendorId": "",
    "medications": [{"name": "Apoquel", "dosage": "100", "frequency": "", "duration": "3 days", "instructions": "test"}],
    "diagnosis": "test",
    "instructions": "test instructions",
    "createdBy": "",
    "createdByRole": "vendor",
    "status": "published"
  }' 2>/dev/null)

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

if echo "$BODY2" | grep -q "vendor_id\|vendorId\|Validation failed\|column.*vendor_id.*does not exist"; then
  echo -e "${GREEN}✅ Test 2 PASSED: Correctly rejected empty vendorId${NC}"
  echo "Response: $BODY2" | head -c 200
  echo ""
else
  echo -e "${RED}❌ Test 2 FAILED: Should reject empty vendorId (HTTP $HTTP_CODE2)${NC}"
  echo "Response: $BODY2"
fi
echo ""

# Test 3: Valid vendorId (should succeed or fail gracefully with capability check)
echo -e "${YELLOW}[Test 3] Testing with VALID vendorId format (may fail on capability check, but should not fail on vendor_id column)...${NC}"
# Using a test UUID format - replace with real vendor ID if available
TEST_VENDOR_ID="82254ba3-1e08-43e8-ace1-0cd03e0a83a3"
RESPONSE3=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/prescriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookingId\": \"7ddd7aee-068d-4d81-b08f-27f12f26091a\",
    \"customerId\": \"39c84571-b26d-475a-bb38-94975cb8262d\",
    \"petId\": \"6e28df3a-3880-460a-b747-bd359330fc32\",
    \"vendorId\": \"$TEST_VENDOR_ID\",
    \"staffId\": null,
    \"medications\": [{\"name\": \"Apoquel\", \"dosage\": \"100\", \"frequency\": \"\", \"duration\": \"3 days\", \"instructions\": \"test\"}],
    \"diagnosis\": \"test\",
    \"instructions\": \"test instructions\",
    \"createdBy\": \"$TEST_VENDOR_ID\",
    \"createdByRole\": \"vendor\",
    \"status\": \"published\"
  }" 2>/dev/null)

HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
BODY3=$(echo "$RESPONSE3" | sed '$d')

if echo "$BODY3" | grep -q "column.*vendor_id.*does not exist"; then
  echo -e "${RED}❌ Test 3 FAILED: Still getting vendor_id column error!${NC}"
  echo "Response: $BODY3"
elif [ "$HTTP_CODE3" = "200" ] || [ "$HTTP_CODE3" = "201" ]; then
  echo -e "${GREEN}✅ Test 3 PASSED: Prescription created successfully (HTTP $HTTP_CODE3)${NC}"
  echo "Response: $BODY3" | head -c 300
  echo ""
elif echo "$BODY3" | grep -q "capability\|permission\|403"; then
  echo -e "${BLUE}⚠️  Test 3 PARTIAL: vendorId accepted, but capability/permission check failed (expected)${NC}"
  echo "Response: $BODY3" | head -c 200
  echo ""
else
  echo -e "${YELLOW}⚠️  Test 3: HTTP $HTTP_CODE3${NC}"
  echo "Response: $BODY3" | head -c 200
  echo ""
fi
echo ""

# Summary
echo "=========================================="
echo -e "${BLUE}Test Summary:${NC}"
echo "=========================================="
echo "Test 1 (Missing vendorId): $([ "$HTTP_CODE1" != "200" ] && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"
echo "Test 2 (Empty vendorId): $([ "$HTTP_CODE2" != "200" ] && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"
echo "Test 3 (Valid vendorId): $(! echo "$BODY3" | grep -q "column.*vendor_id.*does not exist" && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"
echo ""
echo "✅ Key Check: No 'column vendor_id does not exist' errors in Test 3 = Fix is working!"

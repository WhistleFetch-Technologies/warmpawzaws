#!/bin/bash

# Test Tele Queue Join Endpoint using curl
# Usage: ./scripts/test-tele-queue-join-curl.sh [customerId] [petId]

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Tele Queue Join - curl Test                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Get available providers
echo -e "${BLUE}📋 Step 1: Fetching available providers...${NC}"
PROVIDERS_RESPONSE=$(curl -s "${API_BASE}/customer/tele/available-providers?roleId=veterinarian")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to fetch providers${NC}"
  exit 1
fi

# Extract first provider and service using Python
PROVIDER_DATA=$(echo "$PROVIDERS_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success') and data.get('providers') and len(data['providers']) > 0:
    provider = data['providers'][0]
    service = provider['services'][0] if provider.get('services') and len(provider['services']) > 0 else None
    if service:
        print(json.dumps({
            'staffId': provider.get('staffId') or provider.get('providerId'),
            'vendorId': provider.get('vendorId'),
            'providerName': provider.get('name'),
            'serviceId': service.get('id'),
            'serviceName': service.get('name'),
            'price': service.get('price')
        }))
    else:
        print('NO_SERVICE')
        sys.exit(1)
else:
    print('NO_PROVIDERS')
    sys.exit(1)
")

if [ "$PROVIDER_DATA" = "NO_PROVIDERS" ] || [ "$PROVIDER_DATA" = "NO_SERVICE" ]; then
  echo -e "${RED}❌ No providers or services available${NC}"
  exit 1
fi

STAFF_ID=$(echo "$PROVIDER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['staffId'])")
SERVICE_ID=$(echo "$PROVIDER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['serviceId'])")
PROVIDER_NAME=$(echo "$PROVIDER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['providerName'])")
SERVICE_NAME=$(echo "$PROVIDER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['serviceName'])")

echo -e "${GREEN}✅ Found provider: ${PROVIDER_NAME}${NC}"
echo -e "   Staff ID: ${STAFF_ID}"
echo -e "   Service: ${SERVICE_NAME} (ID: ${SERVICE_ID})"
echo ""

# Step 2: Get customer and pet IDs
CUSTOMER_ID="${1:-39c84571-b26d-475a-bb38-94975cb8262d}"
PET_ID="${2:-6e28df3a-3880-460a-b747-bd359330fc32}"

echo -e "${BLUE}📋 Step 2: Using test IDs${NC}"
echo -e "   Customer ID: ${CUSTOMER_ID}"
echo -e "   Pet ID: ${PET_ID}"
echo ""

# Step 3: Test queue join
echo -e "${BLUE}📋 Step 3: Testing queue join...${NC}"
echo -e "${YELLOW}Request:${NC}"
echo "  POST ${API_BASE}/customer/tele/join-queue"
echo "  Body:"
echo "    customerId: ${CUSTOMER_ID}"
echo "    staffId: ${STAFF_ID}"
echo "    petId: ${PET_ID}"
echo "    serviceId: ${SERVICE_ID}"
echo "    urgency: normal"
echo ""

JOIN_RESPONSE=$(curl -s -X POST "${API_BASE}/customer/tele/join-queue" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"${CUSTOMER_ID}\",
    \"staffId\": \"${STAFF_ID}\",
    \"petId\": \"${PET_ID}\",
    \"serviceId\": \"${SERVICE_ID}\",
    \"urgency\": \"normal\",
    \"symptoms\": \"Test consultation via curl\"
  }" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$JOIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$JOIN_RESPONSE" | sed '/HTTP_STATUS:/d')

echo -e "${YELLOW}Response:${NC}"
echo -e "  Status: ${HTTP_STATUS}"
echo "  Body:"
echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

# Check result
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo -e "${GREEN}✅ Queue join successful!${NC}"
  
  # Extract queue ID if available
  QUEUE_ID=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('queueEntry', {}).get('id', 'N/A'))" 2>/dev/null)
  if [ "$QUEUE_ID" != "N/A" ] && [ -n "$QUEUE_ID" ]; then
    echo -e "   Queue ID: ${QUEUE_ID}"
  fi
elif [ "$HTTP_STATUS" = "400" ]; then
  ERROR_MSG=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null)
  echo -e "${YELLOW}⚠️  Validation error (400):${NC}"
  echo -e "   ${ERROR_MSG}"
  echo ""
  echo -e "${YELLOW}ℹ️  This might be due to:${NC}"
  echo -e "   - Invalid customer ID (customer doesn't exist)"
  echo -e "   - Invalid pet ID (pet doesn't exist or doesn't belong to customer)"
  echo -e "   - Service ID validation issue"
elif [ "$HTTP_STATUS" = "500" ]; then
  ERROR_MSG=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null)
  echo -e "${RED}❌ Server error (500):${NC}"
  echo -e "   ${ERROR_MSG}"
  echo ""
  echo -e "${YELLOW}🔍 Check:${NC}"
  echo -e "   1. Check CloudWatch logs for detailed error"
  echo -e "   2. Verify migration 216 is applied"
  echo -e "   3. Check database constraints"
else
  echo -e "${YELLOW}⚠️  Unexpected status: ${HTTP_STATUS}${NC}"
fi

echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo -e "   - To test with different IDs: ./scripts/test-tele-queue-join-curl.sh <customerId> <petId>"
echo -e "   - Check logs: ./scripts/check-tele-queue-logs.sh dev ap-south-1 5"

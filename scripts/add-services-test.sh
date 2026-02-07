#!/bin/bash

# Add services for vendor 9876545521
# Using the vendor identity ID from the console logs: fd6c9fb2-bca1-495d-9c9b-af0f824f711d

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

# Get a valid token
echo "Getting auth token..."
TOKEN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876545521", "otp": "123456"}')

echo "Token response: $TOKEN_RESPONSE"

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:50}..."

# Get vendor ID
VENDOR_ID=$(echo $TOKEN_RESPONSE | grep -o '"vendorId":"[^"]*' | cut -d'"' -f4)
echo "Vendor ID: $VENDOR_ID"

if [ -z "$VENDOR_ID" ]; then
  # Try to get from identity endpoint
  VENDOR_ID="fd6c9fb2-bca1-495d-9c9b-af0f824f711d"
  echo "Using fallback vendor ID: $VENDOR_ID"
fi

# First, get the service catalog
echo -e "\n📋 Getting service catalog..."
CATALOG=$(curl -s -X GET "$API_BASE/services/catalog" \
  -H "Authorization: Bearer $TOKEN")
echo "Catalog response (first 500 chars): ${CATALOG:0:500}"

# Add a sample at_center service
echo -e "\n➕ Adding at_center service..."
curl -s -X POST "$API_BASE/vendor/$VENDOR_ID/services" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "serviceId": "general-checkup",
    "serviceStyle": "at_center",
    "serviceName": "General Pet Checkup",
    "categoryName": "General",
    "price": 500,
    "duration": 30,
    "description": "Comprehensive health checkup for your pet"
  }'

echo -e "\n"

# Add a sample at_home service
echo -e "\n➕ Adding at_home service..."
curl -s -X POST "$API_BASE/vendor/$VENDOR_ID/services" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "serviceId": "home-visit",
    "serviceStyle": "at_home",
    "serviceName": "Home Visit Consultation",
    "categoryName": "General",
    "price": 800,
    "duration": 60,
    "description": "Convenient at-home veterinary consultation"
  }'

echo -e "\n"

# Add a sample tele service
echo -e "\n➕ Adding tele service..."
curl -s -X POST "$API_BASE/vendor/$VENDOR_ID/services" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "serviceId": "video-consult",
    "serviceStyle": "tele",
    "serviceName": "Video Consultation",
    "categoryName": "General",
    "price": 300,
    "duration": 20,
    "description": "Connect with vet via video call"
  }'

echo -e "\n\n✅ Services added! Let's verify..."

# Verify services were added
curl -s -X GET "$API_BASE/vendor/$VENDOR_ID/services" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n"

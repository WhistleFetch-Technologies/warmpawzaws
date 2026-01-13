#!/bin/bash

# ============================================================================
# Login Flow Testing Script
# Tests customer, vendor, and admin login flows to verify hard refresh fix
# ============================================================================

# API Base URL (adjust if needed)
API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Login Flow Testing - Hard Refresh Fix${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test phone numbers (UAT mode uses 123456 as OTP)
CUSTOMER_PHONE="9876543210"
VENDOR_PHONE="9876543211"
ADMIN_EMAIL="admin@warmpawz.com"
ADMIN_PASSWORD="Warmpawz2025"

# ============================================================================
# TEST 1: Customer Login Flow
# ============================================================================
echo -e "${YELLOW}TEST 1: Customer Login Flow${NC}"
echo "----------------------------------------"

# Step 1: Send OTP
echo -e "${BLUE}Step 1: Sending OTP to customer...${NC}"
CUSTOMER_SEND_OTP_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"${CUSTOMER_PHONE}\", \"role\": \"customer\"}")

echo "Response: $CUSTOMER_SEND_OTP_RESPONSE"
echo ""

# Check if OTP was sent successfully
if echo "$CUSTOMER_SEND_OTP_RESPONSE" | grep -q "success\|message"; then
  echo -e "${GREEN}✓ OTP sent successfully${NC}"
else
  echo -e "${RED}✗ Failed to send OTP${NC}"
  echo "$CUSTOMER_SEND_OTP_RESPONSE"
  exit 1
fi

# Step 2: Verify OTP (UAT mode uses 123456)
echo -e "${BLUE}Step 2: Verifying OTP (using 123456 for UAT)...${NC}"
CUSTOMER_VERIFY_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"${CUSTOMER_PHONE}\", \"otp\": \"123456\", \"role\": \"customer\"}")

echo "Response: $CUSTOMER_VERIFY_RESPONSE"
echo ""

# Extract token from response
CUSTOMER_TOKEN=$(echo "$CUSTOMER_VERIFY_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || \
                 echo "$CUSTOMER_VERIFY_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || \
                 echo "$CUSTOMER_VERIFY_RESPONSE" | grep -o '"token"[^}]*"access_token":"[^"]*"' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CUSTOMER_TOKEN" ]; then
  echo -e "${GREEN}✓ Customer OTP verified successfully${NC}"
  echo -e "${GREEN}  Token: ${CUSTOMER_TOKEN:0:50}...${NC}"
  
  # Check if response includes state information
  if echo "$CUSTOMER_VERIFY_RESPONSE" | grep -q '"state"'; then
    echo -e "${GREEN}✓ Response includes 'state' field${NC}"
  else
    echo -e "${YELLOW}⚠ Response missing 'state' field${NC}"
  fi
  
  # Check if response includes onboarding_status
  if echo "$CUSTOMER_VERIFY_RESPONSE" | grep -q '"onboarding_status"\|"onboardingStatus"'; then
    echo -e "${GREEN}✓ Response includes onboarding status${NC}"
  else
    echo -e "${YELLOW}⚠ Response missing onboarding status${NC}"
  fi
else
  echo -e "${RED}✗ Failed to verify OTP or extract token${NC}"
  echo "$CUSTOMER_VERIFY_RESPONSE"
  exit 1
fi

echo ""
echo ""

# ============================================================================
# TEST 2: Vendor Login Flow
# ============================================================================
echo -e "${YELLOW}TEST 2: Vendor Login Flow${NC}"
echo "----------------------------------------"

# Step 1: Send OTP
echo -e "${BLUE}Step 1: Sending OTP to vendor...${NC}"
VENDOR_SEND_OTP_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"${VENDOR_PHONE}\", \"role\": \"vendor\"}")

echo "Response: $VENDOR_SEND_OTP_RESPONSE"
echo ""

if echo "$VENDOR_SEND_OTP_RESPONSE" | grep -q "success\|message"; then
  echo -e "${GREEN}✓ OTP sent successfully${NC}"
else
  echo -e "${RED}✗ Failed to send OTP${NC}"
  echo "$VENDOR_SEND_OTP_RESPONSE"
  exit 1
fi

# Step 2: Verify OTP
echo -e "${BLUE}Step 2: Verifying OTP (using 123456 for UAT)...${NC}"
VENDOR_VERIFY_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"${VENDOR_PHONE}\", \"otp\": \"123456\", \"role\": \"vendor\"}")

echo "Response: $VENDOR_VERIFY_RESPONSE"
echo ""

# Extract token
VENDOR_TOKEN=$(echo "$VENDOR_VERIFY_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || \
               echo "$VENDOR_VERIFY_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || \
               echo "$VENDOR_VERIFY_RESPONSE" | grep -o '"token"[^}]*"access_token":"[^"]*"' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$VENDOR_TOKEN" ]; then
  echo -e "${GREEN}✓ Vendor OTP verified successfully${NC}"
  echo -e "${GREEN}  Token: ${VENDOR_TOKEN:0:50}...${NC}"
  
  # Check for state and onboarding_status
  if echo "$VENDOR_VERIFY_RESPONSE" | grep -q '"state"'; then
    echo -e "${GREEN}✓ Response includes 'state' field${NC}"
  else
    echo -e "${YELLOW}⚠ Response missing 'state' field${NC}"
  fi
  
  if echo "$VENDOR_VERIFY_RESPONSE" | grep -q '"onboarding_status"\|"onboardingStatus"'; then
    echo -e "${GREEN}✓ Response includes onboarding status${NC}"
  else
    echo -e "${YELLOW}⚠ Response missing onboarding status${NC}"
  fi
else
  echo -e "${RED}✗ Failed to verify OTP or extract token${NC}"
  echo "$VENDOR_VERIFY_RESPONSE"
  exit 1
fi

echo ""
echo ""

# ============================================================================
# TEST 3: Admin Login Flow
# ============================================================================
echo -e "${YELLOW}TEST 3: Admin Login Flow${NC}"
echo "----------------------------------------"

echo -e "${BLUE}Logging in as admin...${NC}"
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}")

echo "Response: $ADMIN_LOGIN_RESPONSE"
echo ""

# Extract token
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || \
              echo "$ADMIN_LOGIN_RESPONSE" | grep -o '"token"[^}]*"access_token":"[^"]*"' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login successful${NC}"
  echo -e "${GREEN}  Token: ${ADMIN_TOKEN:0:50}...${NC}"
else
  echo -e "${RED}✗ Failed to login or extract token${NC}"
  echo "$ADMIN_LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo ""

# ============================================================================
# TEST 4: Verify Customer Profile Endpoint Returns State
# ============================================================================
echo -e "${YELLOW}TEST 4: Customer Profile State Check${NC}"
echo "----------------------------------------"

if [ -n "$CUSTOMER_TOKEN" ]; then
  echo -e "${BLUE}Fetching customer profile with token...${NC}"
  CUSTOMER_PROFILE_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/customer/profile/unified/${CUSTOMER_PHONE}" \
    -H "Authorization: Bearer ${CUSTOMER_TOKEN}" \
    -H "Content-Type: application/json")
  
  echo "Response: $CUSTOMER_PROFILE_RESPONSE"
  echo ""
  
  # Check if profile includes onboarding_status
  if echo "$CUSTOMER_PROFILE_RESPONSE" | grep -q '"onboarding_status"\|"onboardingStatus"'; then
    echo -e "${GREEN}✓ Profile includes onboarding_status${NC}"
  else
    echo -e "${YELLOW}⚠ Profile missing onboarding_status${NC}"
  fi
  
  # Check if profile includes profile_completed
  if echo "$CUSTOMER_PROFILE_RESPONSE" | grep -q '"profile_completed"\|"profileCompleted"'; then
    echo -e "${GREEN}✓ Profile includes profile_completed${NC}"
  else
    echo -e "${YELLOW}⚠ Profile missing profile_completed${NC}"
  fi
else
  echo -e "${RED}✗ Cannot test profile endpoint - no customer token${NC}"
fi

echo ""
echo ""

# ============================================================================
# TEST 5: Verify Vendor Onboarding Status Endpoint
# ============================================================================
echo -e "${YELLOW}TEST 5: Vendor Onboarding Status Check${NC}"
echo "----------------------------------------"

if [ -n "$VENDOR_TOKEN" ]; then
  echo -e "${BLUE}Fetching vendor onboarding status...${NC}"
  VENDOR_STATUS_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/vendor/onboarding/status?phone=${VENDOR_PHONE}" \
    -H "Authorization: Bearer ${VENDOR_TOKEN}" \
    -H "Content-Type: application/json")
  
  echo "Response: $VENDOR_STATUS_RESPONSE"
  echo ""
  
  # Check if response includes onboarding_status
  if echo "$VENDOR_STATUS_RESPONSE" | grep -q '"onboarding_status"'; then
    echo -e "${GREEN}✓ Response includes onboarding_status${NC}"
  else
    echo -e "${YELLOW}⚠ Response missing onboarding_status${NC}"
  fi
else
  echo -e "${RED}✗ Cannot test status endpoint - no vendor token${NC}"
fi

echo ""
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ -n "$CUSTOMER_TOKEN" ]; then
  echo -e "${GREEN}✓ Customer login: SUCCESS${NC}"
else
  echo -e "${RED}✗ Customer login: FAILED${NC}"
fi

if [ -n "$VENDOR_TOKEN" ]; then
  echo -e "${GREEN}✓ Vendor login: SUCCESS${NC}"
else
  echo -e "${RED}✗ Vendor login: FAILED${NC}"
fi

if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login: SUCCESS${NC}"
else
  echo -e "${RED}✗ Admin login: FAILED${NC}"
fi

echo ""
echo -e "${YELLOW}Note:${NC} To fully test hard refresh behavior, you need to:"
echo "1. Open browser DevTools → Application → Storage"
echo "2. Login via web UI"
echo "3. Verify sessionStorage has '_warmpawz_has_session' flag"
echo "4. Press F5 (hard refresh)"
echo "5. Verify sessionStorage is cleared and localStorage tokens are cleared"
echo "6. Verify redirect to login page"
echo ""

echo -e "${BLUE}========================================${NC}"
echo "Testing complete!"
echo -e "${BLUE}========================================${NC}"

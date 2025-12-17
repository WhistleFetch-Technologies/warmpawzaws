#!/bin/bash

# Comprehensive Notification Test Script
# Tests email, SMS (OTP), and in-app notifications

set -e

# Get project ID from info file or use environment variable
PROJECT_ID=${PROJECT_ID:-$(grep -oP 'projectId:\s*"\K[^"]+' src/utils/supabase/info.tsx 2>/dev/null || echo "your-project-id")}
API_BASE="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

# Test configuration
TEST_EMAIL="ketan.hirani@gmail.com"
TEST_PHONES=("9611377119" "8296414048")
EMAIL_SOURCE="noreply@warmpawz.com"
SMS_SENDER_ID="WARMP-VX"

echo "🧪 ========================================"
echo "   COMPREHENSIVE NOTIFICATION TEST SUITE"
echo "   ========================================"
echo ""
echo "📧 Test Email: ${TEST_EMAIL}"
echo "📱 Test Phones: ${TEST_PHONES[*]}"
echo "📧 Email Source: ${EMAIL_SOURCE}"
echo "📱 SMS Sender ID: ${SMS_SENDER_ID}"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$endpoint" \
            -H "Content-Type: application/json" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -c 200
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}📱 OTP TESTS${NC}"
echo -e "${BLUE}==================================================${NC}"

for phone in "${TEST_PHONES[@]}"; do
    test_endpoint "OTP to +91${phone}" "POST" "/auth/send-otp" "{\"phone\": \"+91${phone}\"}"
    sleep 1
done

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}📧 EMAIL NOTIFICATION TESTS${NC}"
echo -e "${BLUE}==================================================${NC}"

test_endpoint "Email notification to ${TEST_EMAIL}" "POST" "/notifications/send" "{
  \"recipientId\": \"test_user_email\",
  \"recipientType\": \"customer\",
  \"recipientEmail\": \"${TEST_EMAIL}\",
  \"type\": \"system_announcement\",
  \"category\": \"system\",
  \"title\": \"🧪 Test Email Notification - Warmpawz\",
  \"message\": \"This is a test email notification from Warmpawz notification system. If you receive this, email notifications are working correctly!\",
  \"channels\": {
    \"email\": true,
    \"sms\": false,
    \"inApp\": true,
    \"push\": false
  },
  \"priority\": \"high\",
  \"data\": {
    \"actionUrl\": \"https://warmpawz.com\",
    \"testType\": \"email_verification\"
  }
}"

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}📱 SMS NOTIFICATION TESTS${NC}"
echo -e "${BLUE}==================================================${NC}"

for phone in "${TEST_PHONES[@]}"; do
    test_endpoint "SMS notification to +91${phone}" "POST" "/notifications/send" "{
      \"recipientId\": \"test_user_${phone}\",
      \"recipientType\": \"customer\",
      \"recipientPhone\": \"+91${phone}\",
      \"type\": \"booking_confirmed\",
      \"category\": \"bookings\",
      \"title\": \"Booking Confirmed\",
      \"message\": \"🧪 Test SMS from Warmpawz. This is a test notification. Sender ID: ${SMS_SENDER_ID}\",
      \"channels\": {
        \"email\": false,
        \"sms\": true,
        \"inApp\": true,
        \"push\": false
      },
      \"priority\": \"high\",
      \"data\": {
        \"bookingId\": \"TEST-BOOKING-123\",
        \"testType\": \"sms_verification\"
      }
    }"
    sleep 1
done

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🔔 IN-APP NOTIFICATION TESTS${NC}"
echo -e "${BLUE}==================================================${NC}"

test_endpoint "In-app notification (customer)" "POST" "/notifications/send" "{
  \"recipientId\": \"test_customer_123\",
  \"recipientType\": \"customer\",
  \"recipientPhone\": \"+91${TEST_PHONES[0]}\",
  \"type\": \"system_announcement\",
  \"category\": \"system\",
  \"title\": \"🧪 Test In-App Notification\",
  \"message\": \"This is a test in-app notification. Check your notification center!\",
  \"channels\": {
    \"email\": false,
    \"sms\": false,
    \"inApp\": true,
    \"push\": false
  },
  \"priority\": \"medium\",
  \"data\": {
    \"testType\": \"inapp_verification\"
  }
}"

test_endpoint "In-app notification (vendor)" "POST" "/notifications/send" "{
  \"recipientId\": \"test_vendor_123\",
  \"recipientType\": \"vendor\",
  \"type\": \"vendor_application_approved\",
  \"category\": \"vendor_onboarding\",
  \"title\": \"🧪 Test Vendor Notification\",
  \"message\": \"This is a test vendor notification.\",
  \"channels\": {
    \"email\": false,
    \"sms\": false,
    \"inApp\": true,
    \"push\": false
  },
  \"priority\": \"high\"
}"

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🏪 VENDOR NOTIFICATION TESTS (All Channels)${NC}"
echo -e "${BLUE}==================================================${NC}"

test_endpoint "Vendor notification (email + SMS + in-app)" "POST" "/notifications/send" "{
  \"recipientId\": \"test_vendor_123\",
  \"recipientType\": \"vendor\",
  \"recipientEmail\": \"${TEST_EMAIL}\",
  \"recipientPhone\": \"+91${TEST_PHONES[0]}\",
  \"type\": \"vendor_application_approved\",
  \"category\": \"vendor_onboarding\",
  \"title\": \"✅ Application Approved - Welcome to Warmpawz!\",
  \"message\": \"🧪 Test: Congratulations! Your vendor application has been approved. This is a test notification.\",
  \"channels\": {
    \"email\": true,
    \"sms\": true,
    \"inApp\": true,
    \"push\": false
  },
  \"priority\": \"high\",
  \"data\": {
    \"vendorName\": \"Test Vendor\",
    \"roleName\": \"Test Role\",
    \"testType\": \"vendor_notification_verification\"
  }
}"

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo -e "${CYAN}Total: $((TESTS_PASSED + TESTS_FAILED))${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${YELLOW}⚠️ Some tests failed. Check configuration and AWS settings.${NC}"
fi

echo ""
echo -e "${CYAN}📋 Next Steps:${NC}"
echo -e "${YELLOW}1. Check your email inbox (${TEST_EMAIL}) for test email${NC}"
echo -e "${YELLOW}2. Check SMS on both phone numbers (+91${TEST_PHONES[0]}, +91${TEST_PHONES[1]})${NC}"
echo -e "${YELLOW}3. Verify in-app notifications in customer/vendor apps${NC}"
echo -e "${YELLOW}4. Verify AWS SNS/SES configuration in Admin Panel${NC}"
echo -e "${YELLOW}5. Check AWS SNS console for SMS delivery status${NC}"
echo -e "${YELLOW}6. Check AWS SES console for email delivery status${NC}"
echo ""


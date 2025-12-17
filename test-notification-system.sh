#!/bin/bash

# Notification System Test Script
# Tests email, SMS, and in-app notifications across the system

set -e

PROJECT_ID=$(grep -oP 'projectId:\s*"\K[^"]+' src/utils/supabase/info.tsx 2>/dev/null || echo "your-project-id")
API_BASE="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

echo "🧪 Testing Notification System"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
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
        echo "  Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📧 EMAIL NOTIFICATION TESTS"
echo "---------------------------"

# Test 1: Check email notification endpoint
test_endpoint "Email notification creation" "POST" "/notifications/create" '{
  "recipientId": "test_vendor_123",
  "recipientType": "vendor",
  "recipientEmail": "test@example.com",
  "type": "vendor_application_approved",
  "category": "vendor_onboarding",
  "title": "Test Email Notification",
  "message": "This is a test email notification",
  "channels": {
    "email": true,
    "sms": false,
    "inApp": true,
    "push": false
  },
  "priority": "high"
}'

echo ""
echo "📱 SMS NOTIFICATION TESTS"
echo "------------------------"

# Test 2: Check SMS notification endpoint
test_endpoint "SMS notification creation" "POST" "/notifications/create" '{
  "recipientId": "test_customer_123",
  "recipientType": "customer",
  "recipientPhone": "+919876543210",
  "type": "booking_confirmed",
  "category": "bookings",
  "title": "Test SMS Notification",
  "message": "This is a test SMS notification",
  "channels": {
    "email": false,
    "sms": true,
    "inApp": true,
    "push": false
  },
  "priority": "high"
}'

# Test 3: SMS send endpoint
test_endpoint "SMS send endpoint" "POST" "/sms/send" '{
  "to": "+919876543210",
  "event": "booking_created",
  "variables": {
    "customerName": "Test Customer",
    "bookingId": "BOOK123",
    "serviceName": "Pet Grooming",
    "date": "2024-12-20",
    "time": "10:00 AM"
  }
}'

echo ""
echo "🔔 IN-APP NOTIFICATION TESTS"
echo "----------------------------"

# Test 4: In-app notification creation
test_endpoint "In-app notification creation" "POST" "/notifications/create" '{
  "recipientId": "test_vendor_123",
  "recipientType": "vendor",
  "type": "vendor_new_booking",
  "category": "bookings",
  "title": "New Booking Received",
  "message": "You have a new booking request",
  "channels": {
    "email": false,
    "sms": false,
    "inApp": true,
    "push": false
  },
  "priority": "high"
}'

# Test 5: Get vendor notifications
test_endpoint "Get vendor notifications" "GET" "/vendor/notifications/test_vendor_123?limit=10" ""

# Test 6: Get customer notifications
test_endpoint "Get customer notifications" "GET" "/customer/notifications/9876543210?limit=10" ""

echo ""
echo "🔔 PUSH NOTIFICATION TESTS"
echo "--------------------------"

# Test 7: Register push token
test_endpoint "Register push token" "POST" "/notifications/push/register" '{
  "userId": "test_user_123",
  "userType": "customer",
  "token": "test_fcm_token_123",
  "deviceType": "mobile_app"
}'

# Test 8: Send push notification
test_endpoint "Send push notification" "POST" "/notifications/push/send" '{
  "userId": "test_user_123",
  "title": "Test Push Notification",
  "message": "This is a test push notification",
  "data": {}
}'

echo ""
echo "📊 NOTIFICATION ANALYTICS TESTS"
echo "-------------------------------"

# Test 9: Get notification analytics
test_endpoint "Get notification analytics" "GET" "/notifications/analytics?startDate=2024-12-01&endDate=2024-12-31" ""

# Test 10: Get SMS analytics
test_endpoint "Get SMS analytics" "GET" "/sms/analytics?startDate=2024-12-01&endDate=2024-12-31" ""

echo ""
echo "⚙️ NOTIFICATION CONFIGURATION TESTS"
echo "-----------------------------------"

# Test 11: Get notification templates
test_endpoint "Get notification templates" "GET" "/notifications/templates" ""

# Test 12: Get SMS templates
test_endpoint "Get SMS templates" "GET" "/sms/templates" ""

echo ""
echo "📋 SUMMARY"
echo "==========="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All notification tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some notification tests failed${NC}"
    exit 1
fi


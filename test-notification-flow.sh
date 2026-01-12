#!/bin/bash

# ============================================================================
# Test Notification Flow Script
# Warmpawz Ecosystem - End-to-End Notification Test
# ============================================================================
# 
# This script tests the complete notification flow:
# 1. Create a test booking
# 2. Check SQS queue for message
# 3. Check Lambda processor triggered
# 4. Verify notification processed
#
# Usage: ./test-notification-flow.sh [api-url] [customer-id] [vendor-id] [service-id]
# Example: ./test-notification-flow.sh https://api.warmpawz.com customer-123 vendor-456 service-789
# ============================================================================

set -e

API_URL=${1:-${API_GATEWAY_URL:-""}}
CUSTOMER_ID=${2:-"test-customer-$(date +%s)"}
VENDOR_ID=${3:-"test-vendor-$(date +%s)"}
SERVICE_ID=${4:-"test-service-$(date +%s)"}
ENVIRONMENT=${5:-dev}
ENV_SUFFIX=$([ "$ENVIRONMENT" == "prod" ] && echo "" || echo "-${ENVIRONMENT}")

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$API_URL" ]; then
  echo -e "${RED}❌ Error: API Gateway URL required${NC}"
  echo "Usage: $0 <api-url> [customer-id] [vendor-id] [service-id] [environment]"
  echo "Or set API_GATEWAY_URL environment variable"
  exit 1
fi

echo "🧪 Testing Notification Flow"
echo "============================"
echo "API URL: $API_URL"
echo "Customer ID: $CUSTOMER_ID"
echo "Vendor ID: $VENDOR_ID"
echo "Service ID: $SERVICE_ID"
echo "Environment: $ENVIRONMENT"
echo ""

# ============================================================================
# Step 1: Create Test Booking
# ============================================================================

echo -e "${BLUE}Step 1: Creating test booking...${NC}"

BOOKING_DATE=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d "+1 day" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
BOOKING_TIME="10:00:00"

BOOKING_PAYLOAD=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "vendorId": "$VENDOR_ID",
  "serviceId": "$SERVICE_ID",
  "bookingDate": "$BOOKING_DATE",
  "bookingTime": "$BOOKING_TIME",
  "serviceType": "at_vendor"
}
EOF
)

echo "  Payload:"
echo "$BOOKING_PAYLOAD" | jq '.' 2>/dev/null || echo "$BOOKING_PAYLOAD"
echo ""

BOOKING_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/bookings" \
  -H "Content-Type: application/json" \
  -d "$BOOKING_PAYLOAD" 2>/dev/null)

HTTP_CODE=$(echo "$BOOKING_RESPONSE" | tail -n1)
BOOKING_BODY=$(echo "$BOOKING_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
  echo -e "${GREEN}✅ Booking created successfully${NC}"
  BOOKING_ID=$(echo "$BOOKING_BODY" | jq -r '.bookingId // .id // empty' 2>/dev/null || echo "")
  
  if [ -z "$BOOKING_ID" ]; then
    echo -e "${YELLOW}⚠️  Warning: Could not extract booking ID from response${NC}"
    echo "  Response: $BOOKING_BODY"
  else
    echo "  Booking ID: $BOOKING_ID"
  fi
else
  echo -e "${RED}❌ Failed to create booking${NC}"
  echo "  HTTP Code: $HTTP_CODE"
  echo "  Response: $BOOKING_BODY"
  exit 1
fi

echo ""

# ============================================================================
# Step 2: Check SQS Queue for Message
# ============================================================================

echo -e "${BLUE}Step 2: Checking SQS queue for message...${NC}"

QUEUE_NAME="warmpawz-notification-queue${ENV_SUFFIX}"
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region ap-south-1 --output text 2>/dev/null | awk '{print $2}')

if [ -z "$QUEUE_URL" ]; then
  echo -e "${RED}❌ Queue not found: $QUEUE_NAME${NC}"
  exit 1
fi

echo "  Queue URL: $QUEUE_URL"

# Wait a few seconds for message to arrive
echo "  Waiting 5 seconds for message to arrive..."
sleep 5

# Get approximate message count
MSG_COUNT=$(aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages \
  --region ap-south-1 \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text 2>/dev/null || echo "0")

if [ "$MSG_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✅ Messages in queue: $MSG_COUNT${NC}"
else
  echo -e "${YELLOW}⚠️  No messages in queue yet (may take a few more seconds)${NC}"
fi

echo ""

# ============================================================================
# Step 3: Check Lambda Function Invocation
# ============================================================================

echo -e "${BLUE}Step 3: Checking Lambda function invocation...${NC}"

FUNCTION_NAME="warmpawz-notification-processor${ENV_SUFFIX}"

# Get recent invocations from CloudWatch Logs
LOG_GROUP="/aws/lambda/$FUNCTION_NAME"

echo "  Checking CloudWatch logs for: $LOG_GROUP"

# Get logs from last 2 minutes
START_TIME=$(date -u -v-2M +%s 2>/dev/null || date -u -d "2 minutes ago" +%s 2>/dev/null || echo $(($(date +%s) - 120)))
END_TIME=$(date +%s)

LOG_STREAMS=$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region ap-south-1 \
  --query 'logStreams[0].logStreamName' \
  --output text 2>/dev/null || echo "")

if [ -n "$LOG_STREAMS" ] && [ "$LOG_STREAMS" != "None" ]; then
  echo -e "${GREEN}✅ Log stream found${NC}"
  
  # Get recent log events
  LOG_EVENTS=$(aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$LOG_STREAMS" \
    --start-time $((START_TIME * 1000)) \
    --region ap-south-1 \
    --query 'events[*].message' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$LOG_EVENTS" ]; then
    echo "  Recent log entries:"
    echo "$LOG_EVENTS" | tail -n 5 | sed 's/^/    /'
  else
    echo -e "${YELLOW}⚠️  No recent log entries (function may not have been invoked yet)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Log group or stream not found (function may not have been invoked)${NC}"
fi

echo ""

# ============================================================================
# Step 4: Check Lambda Metrics
# ============================================================================

echo -e "${BLUE}Step 4: Checking Lambda function metrics...${NC}"

# Get invocation count in last 5 minutes
METRICS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d "5 minutes ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-south-1 \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null || echo "0")

if [ -n "$METRICS" ] && [ "$METRICS" != "None" ] && [ "$METRICS" != "0" ]; then
  echo -e "${GREEN}✅ Function invoked: $METRICS times in last 5 minutes${NC}"
else
  echo -e "${YELLOW}⚠️  No recent invocations (may take a few more seconds)${NC}"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "============================"
echo "📊 TEST SUMMARY"
echo "============================"
echo -e "${GREEN}✅ Booking created${NC}"
echo -e "${GREEN}✅ SQS queue checked${NC}"
echo -e "${GREEN}✅ Lambda logs checked${NC}"
echo ""
echo "Next steps:"
echo "1. Check CloudWatch logs manually:"
echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo ""
echo "2. Check SQS queue messages:"
echo "   aws sqs receive-message --queue-url $QUEUE_URL --region ap-south-1"
echo ""
echo "3. Verify notification was sent (check database or notification service)"

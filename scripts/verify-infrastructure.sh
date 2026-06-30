#!/bin/bash

# ============================================================================
# Infrastructure Verification Script
# Warmpawz Ecosystem - AWS CLI & cURL Verification
# ============================================================================
# 
# This script verifies:
# 1. Lambda functions exist
# 2. Event source mappings are configured
# 3. SQS queues exist
# 4. SNS topics exist
# 5. Test notification flow
#
# Usage: ./verify-infrastructure.sh [environment]
# Example: ./verify-infrastructure.sh dev
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
ENV_SUFFIX=$([ "$ENVIRONMENT" == "prod" ] && echo "" || echo "-${ENVIRONMENT}")

echo "🔍 Warmpawz Infrastructure Verification"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Date: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# ============================================================================
# 1. VERIFY LAMBDA FUNCTIONS
# ============================================================================

echo "📦 Step 1: Verifying Lambda Functions"
echo "--------------------------------------"

LAMBDA_FUNCTIONS=(
  "warmpawz-notification-processor${ENV_SUFFIX}"
  "warmpawz-email-processor${ENV_SUFFIX}"
  "warmpawz-sms-processor${ENV_SUFFIX}"
  "warmpawz-analytics-retention${ENV_SUFFIX}"
  "warmpawz-settlement-processor${ENV_SUFFIX}"
)

for func_name in "${LAMBDA_FUNCTIONS[@]}"; do
  echo -n "  Checking $func_name... "
  
  if aws lambda get-function --function-name "$func_name" --region ap-south-1 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ EXISTS${NC}"
    PASSED=$((PASSED + 1))
    
    # Get function details
    FUNCTION_INFO=$(aws lambda get-function --function-name "$func_name" --region ap-south-1 --query 'Configuration.[Runtime,LastModified,State]' --output text)
    echo "    Runtime: $(echo $FUNCTION_INFO | cut -d' ' -f1)"
    echo "    State: $(echo $FUNCTION_INFO | cut -d' ' -f3)"
  else
    echo -e "${RED}❌ NOT FOUND${NC}"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

# ============================================================================
# 2. VERIFY EVENT SOURCE MAPPINGS
# ============================================================================

echo "🔗 Step 2: Verifying Event Source Mappings"
echo "-------------------------------------------"

for func_name in "${LAMBDA_FUNCTIONS[@]}"; do
  echo -n "  Checking event sources for $func_name... "
  
  MAPPINGS=$(aws lambda list-event-source-mappings \
    --function-name "$func_name" \
    --region ap-south-1 \
    --query 'EventSourceMappings[*].[EventSourceArn,State]' \
    --output text 2>/dev/null)
  
  if [ -z "$MAPPINGS" ]; then
    echo -e "${RED}❌ NO MAPPINGS${NC}"
    FAILED=$((FAILED + 1))
  else
    echo -e "${GREEN}✅ MAPPINGS FOUND${NC}"
    PASSED=$((PASSED + 1))
    
    # Show mapping details
    while IFS=$'\t' read -r arn state; do
      QUEUE_NAME=$(echo "$arn" | awk -F: '{print $6}' | awk -F/ '{print $2}')
      echo "    Queue: $QUEUE_NAME | State: $state"
      
      if [ "$state" != "Enabled" ]; then
        echo -e "    ${YELLOW}⚠️  WARNING: Mapping is not Enabled${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
    done <<< "$MAPPINGS"
  fi
done

echo ""

# ============================================================================
# 3. VERIFY SQS QUEUES
# ============================================================================

echo "📬 Step 3: Verifying SQS Queues"
echo "--------------------------------"

SQS_QUEUES=(
  "warmpawz-notification-queue${ENV_SUFFIX}"
  "warmpawz-email-queue${ENV_SUFFIX}"
  "warmpawz-sms-queue${ENV_SUFFIX}"
  "warmpawz-analytics-queue${ENV_SUFFIX}"
  "warmpawz-settlement-queue${ENV_SUFFIX}"
)

for queue_name in "${SQS_QUEUES[@]}"; do
  echo -n "  Checking $queue_name... "
  
  QUEUE_URL=$(aws sqs get-queue-url --queue-name "$queue_name" --region ap-south-1 --output text 2>/dev/null | awk '{print $2}')
  
  if [ -n "$QUEUE_URL" ]; then
    echo -e "${GREEN}✅ EXISTS${NC}"
    PASSED=$((PASSED + 1))
    
    # Get queue attributes
    ATTRIBUTES=$(aws sqs get-queue-attributes \
      --queue-url "$QUEUE_URL" \
      --attribute-names All \
      --region ap-south-1 \
      --query 'Attributes.[ApproximateNumberOfMessages,VisibilityTimeout]' \
      --output text 2>/dev/null)
    
    MSG_COUNT=$(echo $ATTRIBUTES | cut -d' ' -f1)
    VISIBILITY=$(echo $ATTRIBUTES | cut -d' ' -f2)
    echo "    Messages: $MSG_COUNT | Visibility Timeout: ${VISIBILITY}s"
  else
    echo -e "${RED}❌ NOT FOUND${NC}"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

# ============================================================================
# 4. VERIFY SNS TOPICS
# ============================================================================

echo "📢 Step 4: Verifying SNS Topics"
echo "--------------------------------"

SNS_TOPICS=(
  "warmpawz-booking-created${ENV_SUFFIX}"
  "warmpawz-payment-processed${ENV_SUFFIX}"
  "warmpawz-vendor-approved${ENV_SUFFIX}"
  "warmpawz-notification${ENV_SUFFIX}"
)

for topic_name in "${SNS_TOPICS[@]}"; do
  echo -n "  Checking $topic_name... "
  
  TOPIC_ARN=$(aws sns list-topics --region ap-south-1 --query "Topics[?contains(TopicArn, '$topic_name')].TopicArn" --output text 2>/dev/null | head -n1)
  
  if [ -n "$TOPIC_ARN" ]; then
    echo -e "${GREEN}✅ EXISTS${NC}"
    PASSED=$((PASSED + 1))
    echo "    ARN: $TOPIC_ARN"
  else
    echo -e "${YELLOW}⚠️  NOT FOUND${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""

# ============================================================================
# 6. TEST API ENDPOINT (if API Gateway URL available)
# ============================================================================

echo "🌐 Step 6: Testing API Endpoint"
echo "--------------------------------"

# Try to get API Gateway URL from environment or config
API_URL=${API_GATEWAY_URL:-""}

if [ -z "$API_URL" ]; then
  echo "  ⚠️  API Gateway URL not set. Set API_GATEWAY_URL environment variable to test."
  echo "  Example: export API_GATEWAY_URL=https://api.warmpawz.com"
  WARNINGS=$((WARNINGS + 1))
else
  echo -n "  Testing health endpoint... "
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL/health" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ HEALTHY${NC}"
    PASSED=$((PASSED + 1))
    
    # Get health response
    HEALTH_RESPONSE=$(curl -s --max-time 5 "$API_URL/health" 2>/dev/null)
    echo "    Response: $HEALTH_RESPONSE"
  elif [ "$HTTP_CODE" == "000" ]; then
    echo -e "${RED}❌ CONNECTION FAILED${NC}"
    FAILED=$((FAILED + 1))
  else
    echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

echo ""

# ============================================================================
# 7. TEST NOTIFICATION FLOW (Optional - requires test data)
# ============================================================================

echo "🧪 Step 7: Testing Notification Flow (Optional)"
echo "------------------------------------------------"

if [ -z "$API_GATEWAY_URL" ]; then
  echo "  ⚠️  Skipping - API Gateway URL not set"
  echo "  Set API_GATEWAY_URL to test notification flow"
else
  echo "  To test notification flow:"
  echo "  1. Create a test booking via API"
  echo "  2. Check SQS queue for message"
  echo "  3. Check CloudWatch logs for Lambda invocation"
  echo ""
  echo "  Example booking creation:"
  echo "  curl -X POST $API_GATEWAY_URL/bookings \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"customerId\":\"test\",\"vendorId\":\"test\",\"serviceId\":\"test\",\"bookingDate\":\"2026-01-29\",\"bookingTime\":\"10:00:00\"}'"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "========================================"
echo "📊 VERIFICATION SUMMARY"
echo "========================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed! Infrastructure is ready.${NC}"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Some warnings found, but no critical failures.${NC}"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Please review and fix issues.${NC}"
  exit 1
fi

#!/bin/bash

# ============================================================================
# Investigate send-otp Timeout Issue
# ============================================================================
# This script helps investigate the timeout issue with /auth/send-otp endpoint
# 
# Usage:
#   ./investigate-send-otp-timeout.sh [phone_number]
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-api-prod}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
PHONE_NUMBER="${1:-919876543210}"  # Default test phone

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Send OTP Timeout Investigation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# 1. Test the endpoint directly
# ============================================================================
echo -e "${YELLOW}[1/4] Testing /auth/send-otp endpoint...${NC}"
echo "URL: ${API_BASE_URL}/auth/send-otp"
echo "Phone: ${PHONE_NUMBER}"
echo ""

START_TIME=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" -X POST "${API_BASE_URL}/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${PHONE_NUMBER}\",\"role\":\"vendor\"}" \
  --max-time 35) || true
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
TIME_TOTAL=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -2)

echo -e "${BLUE}Response:${NC}"
echo "HTTP Code: ${HTTP_CODE}"
echo "Time Total: ${TIME_TOTAL}s"
echo "Duration: ${DURATION}s"
echo "Body: ${BODY}"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Endpoint responded successfully${NC}"
elif [ "$HTTP_CODE" = "503" ] || [ "$HTTP_CODE" = "504" ]; then
  echo -e "${RED}❌ Timeout error detected (${HTTP_CODE})${NC}"
elif [ "$HTTP_CODE" = "000" ]; then
  echo -e "${RED}❌ Connection failed or timeout${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected response code: ${HTTP_CODE}${NC}"
fi
echo ""

# ============================================================================
# 2. Check CloudWatch Logs
# ============================================================================
echo -e "${YELLOW}[2/4] Checking CloudWatch Logs...${NC}"
echo "Log Group: /aws/lambda/${LAMBDA_FUNCTION_NAME}"
echo ""

# Get recent logs (last 5 minutes)
LOG_START_TIME=$(date -u -d '5 minutes ago' +%s)000
LOG_END_TIME=$(date -u +%s)000

echo "Fetching logs from last 5 minutes..."
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install it to check CloudWatch logs.${NC}"
  echo ""
  echo "To check logs manually:"
  echo "1. Go to AWS Console → CloudWatch → Log groups"
  echo "2. Find: /aws/lambda/${LAMBDA_FUNCTION_NAME}"
  echo "3. Filter by: /auth/send-otp"
  echo ""
else
  # Get log streams
  echo "Recent log streams:"
  aws logs describe-log-streams \
    --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
    --order-by LastEventTime \
    --descending \
    --max-items 5 \
    --region "${AWS_REGION}" \
    --query 'logStreams[*].[logStreamName,lastEventTime]' \
    --output table || echo "Failed to fetch log streams"
  echo ""
  
  # Get recent events
  echo "Recent log events (last 5 minutes):"
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
    --start-time "${LOG_START_TIME}" \
    --end-time "${LOG_END_TIME}" \
    --filter-pattern "send-otp" \
    --region "${AWS_REGION}" \
    --max-items 20 \
    --query 'events[*].[timestamp,message]' \
    --output table || echo "Failed to fetch log events"
  echo ""
  
  # Get error events
  echo "Recent error events:"
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
    --start-time "${LOG_START_TIME}" \
    --end-time "${LOG_END_TIME}" \
    --filter-pattern "ERROR" \
    --region "${AWS_REGION}" \
    --max-items 10 \
    --query 'events[*].[timestamp,message]' \
    --output table || echo "Failed to fetch error events"
  echo ""
fi

# ============================================================================
# 3. Check Lambda Metrics
# ============================================================================
echo -e "${YELLOW}[3/4] Checking Lambda Metrics...${NC}"
echo ""

if command -v aws &> /dev/null; then
  # Get Lambda function configuration
  echo "Lambda Function Configuration:"
  aws lambda get-function-configuration \
    --function-name "${LAMBDA_FUNCTION_NAME}" \
    --region "${AWS_REGION}" \
    --query '{Timeout:Timeout,MemorySize:MemorySize,Runtime:Runtime,LastModified:LastModified}' \
    --output table || echo "Failed to fetch Lambda configuration"
  echo ""
  
  # Get recent invocations
  echo "Recent invocations (last hour):"
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value="${LAMBDA_FUNCTION_NAME}" \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region "${AWS_REGION}" \
    --output table || echo "Failed to fetch metrics"
  echo ""
  
  # Get duration metrics
  echo "Average duration (last hour):"
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value="${LAMBDA_FUNCTION_NAME}" \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum \
    --region "${AWS_REGION}" \
    --output table || echo "Failed to fetch duration metrics"
  echo ""
  
  # Get timeout errors
  echo "Timeout errors (last hour):"
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value="${LAMBDA_FUNCTION_NAME}" \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region "${AWS_REGION}" \
    --output table || echo "Failed to fetch error metrics"
  echo ""
fi

# ============================================================================
# 4. Analysis and Recommendations
# ============================================================================
echo -e "${YELLOW}[4/4] Analysis and Recommendations${NC}"
echo ""

echo -e "${BLUE}Key Findings:${NC}"
echo "1. API Gateway HTTP API has a 30-second hard timeout limit"
echo "2. Lambda timeout is set to 60 seconds (but API Gateway times out first)"
echo "3. Client-side timeout is 30 seconds"
echo ""

echo -e "${BLUE}Potential Issues:${NC}"
echo "1. Database query to get platform_settings might be slow"
echo "2. SNS SMS sending might be slow or hanging"
echo "3. VPC cold start delays"
echo "4. Network latency to RDS"
echo ""

echo -e "${BLUE}Recommended Fixes:${NC}"
echo "1. Add timeout to database queries (2-3 seconds max)"
echo "2. Add timeout to SNS calls (5 seconds max)"
echo "3. Make SMS sending non-blocking (fire and forget)"
echo "4. Add better error handling and logging"
echo "5. Consider using async pattern for SMS (queue to SQS)"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Investigation Complete${NC}"
echo -e "${GREEN}========================================${NC}"

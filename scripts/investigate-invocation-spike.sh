#!/bin/bash

# ============================================================================
# Investigate Invocation Spike
# ============================================================================
# Find what's causing 28k+ invocations per 5 minutes
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-warmpawz-prod-api-handler}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
MINUTES_BACK="${1:-30}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Investigate Invocation Spike${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Lambda Function: ${LAMBDA_FUNCTION_NAME}"
echo "Time Range: Last ${MINUTES_BACK} minutes"
echo ""

# Get invocation metrics
echo -e "${YELLOW}[1/4] Checking invocation metrics...${NC}"
INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="${LAMBDA_FUNCTION_NAME}" \
  --start-time $(date -u -d "${MINUTES_BACK} minutes ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region "${AWS_REGION}" \
  --output json)

echo "$INVOCATIONS" | jq -r '.Datapoints | sort_by(.Timestamp) | .[] | "  \(.Timestamp): \(.Sum) invocations"'
TOTAL=$(echo "$INVOCATIONS" | jq '[.Datapoints[].Sum] | add')
echo ""
echo "Total invocations: ${TOTAL}"
echo ""

# Get recent log events and extract paths
echo -e "${YELLOW}[2/4] Analyzing endpoint patterns...${NC}"
LOG_START=$(date -u -d "${MINUTES_BACK} minutes ago" +%s)000
LOG_END=$(date -u +%s)000

PATTERNS=$(aws logs filter-log-events \
  --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
  --start-time "${LOG_START}" \
  --end-time "${LOG_END}" \
  --region "${AWS_REGION}" \
  --max-items 1000 \
  --query 'events[*].message' \
  --output text 2>/dev/null | grep -oP 'path":"[^"]+' | sed 's/path":"//' | sort | uniq -c | sort -rn | head -20) || {
  echo "  Could not analyze patterns"
}

if [ -n "$PATTERNS" ]; then
  echo "Top endpoints by invocation count:"
  echo "$PATTERNS"
else
  echo "  No patterns found"
fi
echo ""

# Check for health endpoint calls
echo -e "${YELLOW}[3/4] Checking health endpoint calls...${NC}"
HEALTH_COUNT=$(aws logs filter-log-events \
  --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
  --start-time "${LOG_START}" \
  --end-time "${LOG_END}" \
  --filter-pattern "health" \
  --region "${AWS_REGION}" \
  --max-items 100 \
  --query 'events | length' \
  --output text 2>/dev/null || echo "0")

echo "  Health endpoint calls: ${HEALTH_COUNT}"
echo ""

# Check for errors
echo -e "${YELLOW}[4/4] Checking error patterns...${NC}"
ERROR_COUNT=$(aws logs filter-log-events \
  --log-group-name "/aws/lambda/${LAMBDA_FUNCTION_NAME}" \
  --start-time "${LOG_START}" \
  --end-time "${LOG_END}" \
  --filter-pattern "ERROR" \
  --region "${AWS_REGION}" \
  --max-items 100 \
  --query 'events | length' \
  --output text 2>/dev/null || echo "0")

echo "  Error count: ${ERROR_COUNT}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "If you see a massive spike:"
echo "1. Check if a health check service is calling the endpoint excessively"
echo "2. Check if there's a retry loop in the frontend"
echo "3. Check if a bot/crawler is hitting the API"
echo "4. Check API Gateway access logs for source IPs"
echo ""

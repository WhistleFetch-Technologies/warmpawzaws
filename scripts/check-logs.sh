#!/bin/bash

# Script to check recent CloudWatch logs for errors

LOG_GROUP="/aws/lambda/warmpawz-api-dev-api"
REGION="ap-south-1"

echo "📊 Checking CloudWatch Logs for Recent Errors"
echo "=============================================="
echo ""

# Get logs from last 10 minutes
START_TIME=$(date -u -v-10M +%s)000

echo "🔍 Searching for ERROR messages in last 10 minutes..."
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "ERROR" \
  --max-items 20 \
  | jq -r '.events[] | "\(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) - \(.message)"' 2>/dev/null || \
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --filter-pattern "ERROR" \
    --max-items 20

echo ""
echo "🔍 Searching for OPTIONS requests..."
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "OPTIONS" \
  --max-items 10 \
  | jq -r '.events[] | "\(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) - \(.message)"' 2>/dev/null || \
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --filter-pattern "OPTIONS" \
    --max-items 10

echo ""
echo "✅ Done. Check the output above for error details."

#!/bin/bash

# Check CloudWatch Logs for Tele Queue Errors
# Usage: ./scripts/check-tele-queue-logs.sh [ENVIRONMENT] [MINUTES]

ENVIRONMENT=${1:-dev}
REGION=${2:-ap-south-1}
MINUTES=${3:-30}
LOG_GROUP="/aws/lambda/warmpawz-api-${ENVIRONMENT}-api"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Tele Queue CloudWatch Logs Check                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Log Group: ${LOG_GROUP}"
echo "Time Range: Last ${MINUTES} minutes"
echo ""

# Calculate start time (macOS and Linux compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  START_TIME=$(($(date +%s) - ${MINUTES} * 60))000
else
  # Linux
  START_TIME=$(($(date +%s) - ${MINUTES} * 60))000
fi

echo "🔍 Searching for TELE-QUEUE log entries..."
echo "─────────────────────────────────────────────"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "TELE-QUEUE" \
  --max-items 50 \
  --output json | jq -r '.events[] | "\(.timestamp | (./1000 | strftime("%Y-%m-%d %H:%M:%S UTC"))) - \(.message)"' 2>/dev/null || \
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "TELE-QUEUE" \
  --max-items 50

echo ""
echo "🔍 Searching for 'Error joining tele queue'..."
echo "─────────────────────────────────────────────"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "Error joining tele queue" \
  --max-items 20 \
  --output json | jq -r '.events[] | "\(.timestamp | (./1000 | strftime("%Y-%m-%d %H:%M:%S UTC"))) - \(.message)"' 2>/dev/null || \
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "Error joining tele queue" \
  --max-items 20

echo ""
echo "🔍 Searching for UUID type mismatch errors..."
echo "─────────────────────────────────────────────"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "uuid = text" \
  --max-items 10 \
  --output json | jq -r '.events[] | "\(.timestamp | (./1000 | strftime("%Y-%m-%d %H:%M:%S UTC"))) - \(.message)"' 2>/dev/null || \
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "uuid = text" \
  --max-items 10

echo ""
echo "🔍 Searching for migration-related errors..."
echo "─────────────────────────────────────────────"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "migration" \
  --max-items 10 \
  --output json | jq -r '.events[] | "\(.timestamp | (./1000 | strftime("%Y-%m-%d %H:%M:%S UTC"))) - \(.message)"' 2>/dev/null || \
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "migration" \
  --max-items 10

echo ""
echo "🔍 Searching for 500 errors on /customer/tele/join-queue..."
echo "─────────────────────────────────────────────"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "join-queue" \
  --max-items 20 \
  --output json | jq -r '.events[] | "\(.timestamp | (./1000 | strftime("%Y-%m-%d %H:%M:%S UTC"))) - \(.message)"' 2>/dev/null || \
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --filter-pattern "join-queue" \
  --max-items 20

echo ""
echo "✅ Log check complete!"
echo ""
echo "💡 Tips:"
echo "   - Use 'jq' for better JSON formatting: brew install jq (macOS) or apt-get install jq (Linux)"
echo "   - Adjust time range by changing MINUTES parameter"
echo "   - For more details, check CloudWatch Console:"
echo "     https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/${LOG_GROUP//\//\$252F}"

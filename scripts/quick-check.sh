#!/bin/bash

# ============================================================================
# Quick Infrastructure Check
# Warmpawz Ecosystem - Fast Status Check
# ============================================================================

ENVIRONMENT=${1:-dev}
ENV_SUFFIX=$([ "$ENVIRONMENT" == "prod" ] && echo "" || echo "-${ENVIRONMENT}")

echo "🔍 Quick Infrastructure Check - $ENVIRONMENT"
echo "=============================================="
echo ""

# Lambda Functions
echo "📦 Lambda Functions:"
for func in notification-processor email-processor sms-processor analytics-retention settlement-processor; do
  FUNC_NAME="warmpawz-${func}${ENV_SUFFIX}"
  if aws lambda get-function --function-name "$FUNC_NAME" --region ap-south-1 > /dev/null 2>&1; then
    STATE=$(aws lambda get-function --function-name "$FUNC_NAME" --region ap-south-1 --query 'Configuration.State' --output text 2>/dev/null)
    echo "  ✅ $func: $STATE"
  else
    echo "  ❌ $func: NOT FOUND"
  fi
done

echo ""

# SQS Queues
echo "📬 SQS Queues:"
for queue in notification-queue email-queue sms-queue analytics-queue settlement-queue; do
  QUEUE_NAME="warmpawz-${queue}${ENV_SUFFIX}"
  if aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region ap-south-1 > /dev/null 2>&1; then
    QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region ap-south-1 --output text 2>/dev/null | awk '{print $2}')
    MSG_COUNT=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names ApproximateNumberOfMessages --region ap-south-1 --query 'Attributes.ApproximateNumberOfMessages' --output text 2>/dev/null)
    echo "  ✅ $queue: $MSG_COUNT messages"
  else
    echo "  ❌ $queue: NOT FOUND"
  fi
done

echo ""

# Event Source Mappings
echo "🔗 Event Source Mappings:"
FUNC_NAME="warmpawz-notification-processor${ENV_SUFFIX}"
MAPPINGS=$(aws lambda list-event-source-mappings --function-name "$FUNC_NAME" --region ap-south-1 --query 'EventSourceMappings[*].State' --output text 2>/dev/null)
if [ -n "$MAPPINGS" ]; then
  echo "  ✅ notification-processor: $MAPPINGS"
else
  echo "  ❌ notification-processor: NO MAPPINGS"
fi

echo ""

# OpenSearch
echo "🔍 OpenSearch:"
DOMAIN="warmpawz-opensearch${ENV_SUFFIX}"
if aws opensearch describe-domain --domain-name "$DOMAIN" --region ap-south-1 > /dev/null 2>&1; then
  ENDPOINT=$(aws opensearch describe-domain --domain-name "$DOMAIN" --region ap-south-1 --query 'DomainStatus.Endpoint' --output text 2>/dev/null)
  echo "  ✅ Domain exists: $ENDPOINT"
else
  echo "  ⚠️  Domain not found (SQL fallback will be used)"
fi

echo ""
echo "✅ Quick check complete!"

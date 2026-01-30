#!/bin/bash
# ============================================================================
# Set Up SQS → Lambda Event Source Mapping
# ============================================================================

set -e

AWS_REGION=${1:-ap-south-1}
ENVIRONMENT=${2:-dev}
LAMBDA_FUNCTION="warmpawz-${ENVIRONMENT}-api-handler"
QUEUE_NAME="warmpawz-${ENVIRONMENT}-payment-processing"

echo "🔧 Setting Up SQS → Lambda Trigger"
echo "==================================="
echo "Region: $AWS_REGION"
echo "Environment: $ENVIRONMENT"
echo "Lambda: $LAMBDA_FUNCTION"
echo "Queue: $QUEUE_NAME"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get queue URL and ARN
echo -e "${BLUE}Getting SQS queue details...${NC}"
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name "$QUEUE_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$QUEUE_URL" ]; then
  echo -e "${RED}❌ Queue not found: $QUEUE_NAME${NC}"
  exit 1
fi

QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn \
  --region "$AWS_REGION" \
  --query 'Attributes.QueueArn' \
  --output text 2>&1)

echo -e "${GREEN}Queue URL: $QUEUE_URL${NC}"
echo -e "${GREEN}Queue ARN: $QUEUE_ARN${NC}"
echo ""

# Check if event source mapping already exists
echo -e "${BLUE}Checking for existing event source mapping...${NC}"
EXISTING_MAPPING=$(aws lambda list-event-source-mappings \
  --function-name "$LAMBDA_FUNCTION" \
  --region "$AWS_REGION" \
  --query "EventSourceMappings[?EventSourceArn=='$QUEUE_ARN']" \
  --output json 2>&1)

if echo "$EXISTING_MAPPING" | jq -e '. | length > 0' > /dev/null 2>&1; then
  MAPPING_UUID=$(echo "$EXISTING_MAPPING" | jq -r '.[0].UUID')
  STATE=$(echo "$EXISTING_MAPPING" | jq -r '.[0].State')
  
  echo -e "${YELLOW}⚠️  Event source mapping already exists${NC}"
  echo "  UUID: $MAPPING_UUID"
  echo "  State: $STATE"
  echo ""
  
  if [ "$STATE" != "Enabled" ]; then
    echo -e "${BLUE}Enabling event source mapping...${NC}"
    aws lambda update-event-source-mapping \
      --uuid "$MAPPING_UUID" \
      --enabled \
      --region "$AWS_REGION" \
      --output json > /tmp/mapping-update.json 2>&1
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Event source mapping enabled${NC}"
    else
      echo -e "${RED}❌ Failed to enable mapping${NC}"
      cat /tmp/mapping-update.json | head -10
    fi
  else
    echo -e "${GREEN}✅ Event source mapping is already enabled${NC}"
  fi
else
  # Create new event source mapping
  echo -e "${BLUE}Creating event source mapping...${NC}"
  
  # First, ensure Lambda has SQS permissions
  echo -e "${BLUE}Checking Lambda SQS permissions...${NC}"
  LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION" \
    --region "$AWS_REGION" \
    --query 'Configuration.FunctionArn' \
    --output text 2>&1)
  
  # Grant SQS permission to invoke Lambda
  aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION" \
    --statement-id "sqs-trigger-$(date +%s)" \
    --action "lambda:InvokeFunction" \
    --principal "sqs.amazonaws.com" \
    --source-arn "$QUEUE_ARN" \
    --region "$AWS_REGION" \
    --output json > /dev/null 2>&1 || echo "Permission might already exist"
  
  # Create event source mapping
  aws lambda create-event-source-mapping \
    --function-name "$LAMBDA_FUNCTION" \
    --event-source-arn "$QUEUE_ARN" \
    --batch-size 10 \
    --maximum-concurrency 5 \
    --region "$AWS_REGION" \
    --output json > /tmp/mapping-create.json 2>&1
  
  if [ $? -eq 0 ]; then
    UUID=$(cat /tmp/mapping-create.json | jq -r '.UUID')
    echo -e "${GREEN}✅ Event source mapping created${NC}"
    echo "  UUID: $UUID"
    echo "  Batch Size: 10"
    echo "  Max Concurrency: 5"
  else
    echo -e "${RED}❌ Failed to create event source mapping${NC}"
    cat /tmp/mapping-create.json | head -10
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}✅ SQS → Lambda trigger configured!${NC}"
echo ""
echo -e "${BLUE}Note:${NC} The Lambda handler needs to process SQS events."
echo -e "${BLUE}      Check if handler supports SQSEvent type.${NC}"

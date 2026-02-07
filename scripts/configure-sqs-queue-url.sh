#!/bin/bash
# ============================================================================
# Configure SQS Payment Queue URL in Lambda Environment
# ============================================================================

set -e

AWS_REGION=${1:-ap-south-1}
ENVIRONMENT=${2:-dev}
LAMBDA_FUNCTION="warmpawz-${ENVIRONMENT}-api-handler"
QUEUE_NAME="warmpawz-${ENVIRONMENT}-payment-processing"

echo "🔧 Configuring SQS Payment Queue URL"
echo "===================================="
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

# Get queue URL
echo -e "${BLUE}Getting SQS queue URL...${NC}"
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name "$QUEUE_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$QUEUE_URL" ]; then
  echo -e "${RED}❌ Failed to get queue URL${NC}"
  echo "Queue might not exist. Creating..."
  
  # Create queue
  QUEUE_URL=$(aws sqs create-queue \
    --queue-name "$QUEUE_NAME" \
    --region "$AWS_REGION" \
    --attributes '{
      "VisibilityTimeout": "300",
      "MessageRetentionPeriod": "345600",
      "ReceiveMessageWaitTimeSeconds": "0"
    }' \
    --query 'QueueUrl' \
    --output text 2>&1)
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to create queue${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Queue created${NC}"
fi

echo -e "${GREEN}Queue URL: $QUEUE_URL${NC}"
echo ""

# Get current environment variables
echo -e "${BLUE}Getting current Lambda environment variables...${NC}"
CURRENT_ENV=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_FUNCTION" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json 2>&1)

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to get Lambda configuration${NC}"
  exit 1
fi

# Update environment variables
echo -e "${BLUE}Updating Lambda environment variables...${NC}"
UPDATED_ENV=$(echo "$CURRENT_ENV" | jq --arg url "$QUEUE_URL" '. + {SQS_PAYMENT_QUEUE_URL: $url}')

aws lambda update-function-configuration \
  --function-name "$LAMBDA_FUNCTION" \
  --environment "Variables=$UPDATED_ENV" \
  --region "$AWS_REGION" \
  --output json > /tmp/lambda-update.json 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ SQS_PAYMENT_QUEUE_URL configured successfully${NC}"
  echo ""
  echo "Environment variable set:"
  echo "  SQS_PAYMENT_QUEUE_URL=$QUEUE_URL"
else
  echo -e "${RED}❌ Failed to update Lambda configuration${NC}"
  cat /tmp/lambda-update.json | head -10
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Configuration complete!${NC}"

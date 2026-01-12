# AWS CLI & cURL Verification Guide
## Warmpawz Ecosystem - Infrastructure Verification

**Date:** 2026-01-28  
**Status:** Ready to Execute  
**Tools:** AWS CLI, cURL

---

## 🚀 QUICK START

### Option 1: Run Complete Verification (Recommended)

```bash
./verify-infrastructure.sh [environment]
```

**Example:**
```bash
./verify-infrastructure.sh dev
```

### Option 2: Quick Status Check

```bash
./quick-check.sh [environment]
```

**Example:**
```bash
./quick-check.sh dev
```

### Option 3: Test Notification Flow

```bash
./test-notification-flow.sh [api-url] [customer-id] [vendor-id] [service-id]
```

**Example:**
```bash
export API_GATEWAY_URL="https://api.warmpawz.com"
./test-notification-flow.sh "$API_GATEWAY_URL" customer-123 vendor-456 service-789 dev
```

---

## 📋 MANUAL VERIFICATION COMMANDS

### 1. Check Lambda Functions

```bash
# List all queue processor functions
for func in notification-processor email-processor sms-processor analytics-processor settlement-processor; do
  echo "Checking warmpawz-${func}-dev..."
  aws lambda get-function --function-name "warmpawz-${func}-dev" --region ap-south-1 --query 'Configuration.[FunctionName,State,LastModified]' --output table
done
```

**Expected Output:**
```
FunctionName                State      LastModified
--------------------------  ---------  -------------------
warmpawz-notification-processor-dev  Active    2026-01-28T10:00:00.000Z
warmpawz-email-processor-dev         Active    2026-01-28T10:00:00.000Z
...
```

### 2. Check Event Source Mappings

```bash
# Check event source mappings for notification processor
FUNC_NAME="warmpawz-notification-processor-dev"
aws lambda list-event-source-mappings \
  --function-name "$FUNC_NAME" \
  --region ap-south-1 \
  --query 'EventSourceMappings[*].[EventSourceArn,State,LastModified]' \
  --output table
```

**Expected Output:**
```
EventSourceArn                                                                   State      LastModified
-------------------------------------------------------------------------------  ---------  -------------------
arn:aws:sqs:ap-south-1:123456789012:warmpawz-notification-queue-dev  Enabled   2026-01-28T10:00:00.000Z
```

### 3. Check SQS Queues

```bash
# List all queues
for queue in notification-queue email-queue sms-queue analytics-queue settlement-queue; do
  QUEUE_NAME="warmpawz-${queue}-dev"
  QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region ap-south-1 --output text 2>/dev/null | awk '{print $2}')
  if [ -n "$QUEUE_URL" ]; then
    MSG_COUNT=$(aws sqs get-queue-attributes \
      --queue-url "$QUEUE_URL" \
      --attribute-names ApproximateNumberOfMessages \
      --region ap-south-1 \
      --query 'Attributes.ApproximateNumberOfMessages' \
      --output text)
    echo "$QUEUE_NAME: $MSG_COUNT messages"
  fi
done
```

### 4. Check SNS Topics

```bash
# List SNS topics
aws sns list-topics --region ap-south-1 --query 'Topics[?contains(TopicArn, `warmpawz`)].TopicArn' --output table
```

### 5. Check OpenSearch Domain

```bash
# Check if OpenSearch domain exists
DOMAIN="warmpawz-opensearch-dev"
aws opensearch describe-domain \
  --domain-name "$DOMAIN" \
  --region ap-south-1 \
  --query 'DomainStatus.[DomainName,Processing,Endpoint]' \
  --output table
```

### 6. Test API Endpoint (cURL)

```bash
# Test health endpoint
API_URL="https://api.warmpawz.com"
curl -X GET "$API_URL/health" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{"status":"ok","timestamp":"2026-01-28T10:00:00Z"}
HTTP Status: 200
```

### 7. Test Booking Creation (cURL)

```bash
# Create a test booking
API_URL="https://api.warmpawz.com"
BOOKING_DATE=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d "+1 day" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)

curl -X POST "$API_URL/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-customer-123",
    "vendorId": "test-vendor-456",
    "serviceId": "test-service-789",
    "bookingDate": "'"$BOOKING_DATE"'",
    "bookingTime": "10:00:00",
    "serviceType": "at_vendor"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

### 8. Check SQS Queue Messages

```bash
# Check messages in notification queue
QUEUE_NAME="warmpawz-notification-queue-dev"
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region ap-south-1 --output text | awk '{print $2}')

aws sqs receive-message \
  --queue-url "$QUEUE_URL" \
  --region ap-south-1 \
  --max-number-of-messages 1 \
  --query 'Messages[*].[MessageId,Body]' \
  --output table
```

### 9. Check CloudWatch Logs

```bash
# Get recent logs from notification processor
LOG_GROUP="/aws/lambda/warmpawz-notification-processor-dev"
LOG_STREAM=$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region ap-south-1 \
  --query 'logStreams[0].logStreamName' \
  --output text)

if [ -n "$LOG_STREAM" ] && [ "$LOG_STREAM" != "None" ]; then
  aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$LOG_STREAM" \
    --region ap-south-1 \
    --limit 10 \
    --query 'events[*].message' \
    --output text
fi
```

### 10. Check Lambda Metrics

```bash
# Get invocation count for notification processor
FUNC_NAME="warmpawz-notification-processor-dev"

aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="$FUNC_NAME" \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d "1 hour ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ap-south-1 \
  --query 'Datapoints[0].Sum' \
  --output text
```

---

## 📊 VERIFICATION CHECKLIST

### Infrastructure Status

- [ ] **Lambda Functions:** All 5 processor functions exist
- [ ] **Event Source Mappings:** All mappings enabled
- [ ] **SQS Queues:** All 5 queues exist
- [ ] **SNS Topics:** All topics exist
- [ ] **OpenSearch:** Domain exists (or SQL fallback verified)
- [ ] **API Gateway:** Health endpoint responding
- [ ] **CloudWatch Logs:** Log groups exist

### Test Notification Flow

- [ ] **Booking Creation:** Can create booking via API
- [ ] **SQS Message:** Message appears in queue
- [ ] **Lambda Invocation:** Processor function triggered
- [ ] **CloudWatch Logs:** Processing logs visible
- [ ] **Notification Sent:** Notification delivered (check database/service)

---

## 🛠️ TROUBLESHOOTING

### Lambda Function Not Found

```bash
# Check if function exists
aws lambda list-functions --region ap-south-1 --query 'Functions[?contains(FunctionName, `warmpawz`)].FunctionName' --output table

# Deploy if missing
cd infrastructure/cdk
npm run build
cdk deploy LambdaStack
```

### Event Source Mapping Missing

```bash
# Check mappings for all functions
for func in notification-processor email-processor sms-processor analytics-processor settlement-processor; do
  echo "=== $func ==="
  aws lambda list-event-source-mappings --function-name "warmpawz-${func}-dev" --region ap-south-1
done

# If missing, redeploy
cd infrastructure/cdk
cdk deploy LambdaStack
```

### SQS Queue Not Found

```bash
# List all queues
aws sqs list-queues --region ap-south-1 --queue-name-prefix warmpawz

# Create if missing (deploy via CDK)
cd infrastructure/cdk
cdk deploy SqsStack
```

### API Gateway Not Responding

```bash
# Test health endpoint
curl -v https://api.warmpawz.com/health

# Check API Gateway in console
# AWS Console → API Gateway → APIs → warmpawz-api
```

### Lambda Function Not Triggering

```bash
# Check event source mapping state
aws lambda list-event-source-mappings \
  --function-name "warmpawz-notification-processor-dev" \
  --region ap-south-1 \
  --query 'EventSourceMappings[*].[EventSourceArn,State,StateTransitionReason]' \
  --output table

# Check Lambda permissions
aws lambda get-policy \
  --function-name "warmpawz-notification-processor-dev" \
  --region ap-south-1
```

---

## 📝 USEFUL COMMANDS REFERENCE

### Environment Variables

```bash
# Set environment
export AWS_REGION="ap-south-1"
export ENVIRONMENT="dev"
export API_GATEWAY_URL="https://api.warmpawz.com"
```

### Quick Checks

```bash
# All Lambda functions
aws lambda list-functions --region ap-south-1 --query 'Functions[?contains(FunctionName, `warmpawz`)].FunctionName' --output table

# All SQS queues
aws sqs list-queues --region ap-south-1 --queue-name-prefix warmpawz

# All SNS topics
aws sns list-topics --region ap-south-1 --query 'Topics[?contains(TopicArn, `warmpawz`)].TopicArn' --output table

# All CloudWatch log groups
aws logs describe-log-groups --region ap-south-1 --log-group-name-prefix /aws/lambda/warmpawz --query 'logGroups[*].logGroupName' --output table
```

---

## ✅ SUCCESS CRITERIA

### All Checks Pass

- ✅ All 5 Lambda functions exist and are Active
- ✅ All 5 event source mappings are Enabled
- ✅ All 5 SQS queues exist
- ✅ All SNS topics exist
- ✅ API Gateway health endpoint returns 200
- ✅ Test booking creates successfully
- ✅ SQS message appears in queue
- ✅ Lambda processor triggers
- ✅ CloudWatch logs show processing

---

**Next Action:** Run `./verify-infrastructure.sh dev` to get complete status report
